import React, { useState, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MidArea from "./components/MidArea";
import PreviewArea from "./components/PreviewArea";

const STAGE_W = 400;
const STAGE_H = 300;

// Two sprites whose bounding boxes overlap by less than this distance have collided.
const COLLISION_DIST = 55;

// Pause between each animation frame so motion is visible on screen.
const FRAME_MS = 80;

// cycled when more than 5 sprites exist.
const COLORS = ["#4C97FF", "#FF6680", "#59C059", "#9966FF", "#FFAB19"];


function deepClone(blocks) {
  return blocks.map(b => ({ ...b, blocks: b.blocks ? deepClone(b.blocks) : undefined }));
}

// Apply fn to the node matching id, leave others unchanged.
function mapNode(blocks, id, fn) {
  return blocks.map(b => {
    if (b.id === id) return fn(b);
    if (b.blocks) return { ...b, blocks: mapNode(b.blocks, id, fn) };
    return b;
  });
}

// Remove the node matching id from anywhere in the tree.
function removeNode(blocks, id) {
  return blocks
    .filter(b => b.id !== id)
    .map(b => (b.blocks ? { ...b, blocks: removeNode(b.blocks, id) } : b));
}

// Append newBlock as a child of the REPEAT node matching parentId.
function appendInner(blocks, parentId, newBlock) {
  return blocks.map(b => {
    if (b.id === parentId) return { ...b, blocks: [...(b.blocks || []), newBlock] };
    if (b.blocks) return { ...b, blocks: appendInner(b.blocks, parentId, newBlock) };
    return b;
  });
}

// Stable unique id generator for blocks and sprites.
let _seq = 0;
const uid = prefix => `${prefix}_${++_seq}_${Math.random().toString(36).slice(2, 6)}`;


export default function App() {
  const [sprites, setSprites] = useState([
    {
      id: "sprite-1",
      name: "Cat 1",
      x: -70, y: 0, direction: 0,
      homeX: -70, homeY: 0,   // reset target on every Play
      blocks: [],
      speechBubble: null,
      colorIdx: 0,
    },
  ]);
  const [activeSprite, setActiveSprite] = useState("sprite-1");
  const [isPlaying, setIsPlaying] = useState(false);

  
  const animRef = useRef(null);

  //  Sprite management 

  function addSprite() {
    const id = uid("sprite");
    const colorIdx = sprites.length % COLORS.length;
    setSprites(prev => [
      ...prev,
      { id, name: `Cat ${prev.length + 1}`, x: 70, y: 0, direction: 0, homeX: 70, homeY: 0, blocks: [], speechBubble: null, colorIdx },
    ]);
     
  }

  function removeSprite(id) {
    setSprites(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeSprite === id) setActiveSprite(next[0]?.id ?? null);
      return next;
    });
  }

  // ── Block management ─────────────────────────────────────────────────────────
  // All four operations work on the active sprite's block tree.

  function patchSprite(spriteId, updater) {
    setSprites(prev => prev.map(s => (s.id === spriteId ? { ...s, ...updater(s) } : s)));
  }

  function addBlock(spriteId, raw) {
    // Assign a fresh id so React keying and tree-walk lookups work correctly.
    const block = { ...raw, id: uid("block") };
    patchSprite(spriteId, s => ({ blocks: [...s.blocks, block] }));
  }

  function updateBlock(spriteId, blockId, patch) {
    patchSprite(spriteId, s => ({ blocks: mapNode(s.blocks, blockId, b => ({ ...b, ...patch })) }));
  }

  function deleteBlock(spriteId, blockId) {
    patchSprite(spriteId, s => ({ blocks: removeNode(s.blocks, blockId) }));
  }

  function addInnerBlock(spriteId, parentId, raw) {
    const block = { ...raw, id: uid("block") };
    patchSprite(spriteId, s => ({ blocks: appendInner(s.blocks, parentId, block) }));
  }

  
  function handlePlay() {
    if (isPlaying) { handleStop(); return; }
    setIsPlaying(true);

    // Reset every sprite to its home position before each run so stale positions
    // from a previous Play don't accidentally trigger the collision detector.
    const state = {
      sprites: sprites.map(s => ({ ...s, x: s.homeX, y: s.homeY, direction: 0, blocks: deepClone(s.blocks), speechBubble: null })),
      stopped: false,
      gen: {},
      running: 0, // live loops + pending relaunches; Play ends when this hits 0
      swappedPairs: new Set(),
    };
    animRef.current = state;

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const pad = 24; // keep sprites inside stage edges
    const isLive = (spriteId, gen) => !state.stopped && state.gen[spriteId] === gen;

    function flush() {
      setSprites(prev => prev.map(s => {
        const live = state.sprites.find(l => l.id === s.id);
        return live ? { ...s, x: live.x, y: live.y, direction: live.direction, speechBubble: live.speechBubble } : s;
      }));
    }

    flush();

    // ── Single-block executor ────────────────────────────────────────────────
    async function execBlock(spriteId, block, gen) {
      if (!isLive(spriteId, gen)) return;
      const sp = state.sprites.find(s => s.id === spriteId);
      if (!sp) return;

      switch (block.type) {

        case "MOVE_STEPS": {
          // Mathematical angles: 0° = right, 90° = up.
          // cos(dir) drives x, sin(dir) drives y (y+ = up in stage coords).
          const rad = (sp.direction * Math.PI) / 180;
          sp.x = clamp(sp.x + Number(block.steps) * Math.cos(rad), -STAGE_W / 2 + pad, STAGE_W / 2 - pad);
          sp.y = clamp(sp.y + Number(block.steps) * Math.sin(rad), -STAGE_H / 2 + pad, STAGE_H / 2 - pad);
          flush();
          await sleep(FRAME_MS);
          checkCollisions(spriteId); 
          break;
        }

        case "TURN_DEGREES": {
          sp.direction += block.dir === "right" ? Number(block.degrees) : -Number(block.degrees);
          flush();
          await sleep(FRAME_MS);
          break;
        }

        case "GO_TO_XY": {
          sp.x = clamp(Number(block.x), -STAGE_W / 2 + pad, STAGE_W / 2 - pad);
          sp.y = clamp(Number(block.y), -STAGE_H / 2 + pad, STAGE_H / 2 - pad);
          flush();
          await sleep(FRAME_MS);
          checkCollisions(spriteId);
          break;
        }

        case "REPEAT": {
          const times = Number(block.times) || 0;
          for (let i = 0; i < times; i++) {
            if (!isLive(spriteId, gen)) return;
            await execBlocks(spriteId, block.blocks || [], gen);
          }
          break;
        }

        case "SAY":
        case "THINK": {
          // Show speech bubble, wait, then clear it.
          sp.speechBubble = { text: block.message, kind: block.type.toLowerCase() };
          flush();
          await sleep(Number(block.seconds) * 1000);
          if (!isLive(spriteId, gen)) return;
          sp.speechBubble = null;
          flush();
          break;
        }

        default: break;
      }
    }

    async function execBlocks(spriteId, blocks, gen) {
      for (const block of blocks) {
        if (!isLive(spriteId, gen)) return;
        await execBlock(spriteId, block, gen);
      }
    }

    function run(spriteId) {
      const sp = state.sprites.find(s => s.id === spriteId);
      if (!sp) return;
      const gen = (state.gen[spriteId] || 0) + 1;
      state.gen[spriteId] = gen;
      state.running++;
      execBlocks(spriteId, sp.blocks, gen).finally(() => {
        if (--state.running === 0 && !state.stopped) setIsPlaying(false);
      });
    }

    function checkCollisions(movedId) {
      const moved = state.sprites.find(s => s.id === movedId);
      if (!moved) return;

      for (const other of state.sprites) {
        if (other.id === movedId) continue;

        // Canonical pair key (sorted) ensures A|B and B|A are the same entry.
        const key = [movedId, other.id].sort().join("|");
        if (state.swappedPairs.has(key)) continue;

        const dx = Math.abs(moved.x - other.x);
        const dy = Math.abs(moved.y - other.y);

        if (dx < COLLISION_DIST && dy < COLLISION_DIST) {
          // ── Swap ────────────────────────────────────────────────────────────
          state.swappedPairs.add(key); // prevent re-swap this run

          [moved.blocks, other.blocks] = [other.blocks, moved.blocks];

          state.gen[movedId]++;
          state.gen[other.id]++;

          state.running++;
          setTimeout(() => {
            if (!state.stopped) {
              run(movedId);
              run(other.id);
            }
            state.running--;
          }, 150);
        }
      }
    }

    // Kick off all sprite loops concurrently; run() ends Play when all finish.
    state.sprites.forEach(s => run(s.id));
    if (state.running === 0) setIsPlaying(false);
  }

  function handleStop() {
    if (animRef.current) animRef.current.stopped = true;
    setIsPlaying(false);
    // Clear any lingering speech bubbles
    setSprites(prev => prev.map(s => ({ ...s, speechBubble: null })));
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const activeSpriteDef = sprites.find(s => s.id === activeSprite) || sprites[0];

  return (
    <div className="bg-blue-100 pt-6 font-sans min-h-screen md:h-screen md:overflow-hidden flex flex-col">
      <div className="flex-1 md:min-h-0 flex flex-col md:flex-row gap-4 md:gap-0">

        <div className="md:flex-1 overflow-hidden flex flex-col sm:flex-row bg-white border-t md:border-r border-gray-200 rounded-t-xl md:rounded-tl-none md:mr-2">
          <Sidebar />
          <MidArea
            sprite={activeSpriteDef}
            onAddBlock={block => addBlock(activeSpriteDef?.id, block)}
            onUpdateBlock={(blockId, patch) => updateBlock(activeSpriteDef?.id, blockId, patch)}
            onDeleteBlock={blockId => deleteBlock(activeSpriteDef?.id, blockId)}
            onAddInnerBlock={(parentId, block) => addInnerBlock(activeSpriteDef?.id, parentId, block)}
          />
        </div>

        <div className="w-full md:w-2/5 md:flex-none overflow-hidden flex flex-col bg-white border-t md:border-l border-gray-200 rounded-t-xl md:rounded-tr-none md:ml-2">
          <PreviewArea
            sprites={sprites}
            activeSprite={activeSprite}
            setActiveSprite={setActiveSprite}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onAddSprite={addSprite}
            onRemoveSprite={removeSprite}
            STAGE_W={STAGE_W}
            STAGE_H={STAGE_H}
            COLORS={COLORS}
          />
        </div>
      </div>
    </div>
  );
}
