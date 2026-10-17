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
      aborted: new Set(),
      swappedPairs: new Set(),
    };
    animRef.current = state;

    // Immediately render the reset positions so the stage shows home before frame 1.
    setSprites(state.sprites.map(s => ({ ...s })));

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const pad = 24; // keep sprites inside stage edges

    // Flush mutable state to React for rendering.
    function flush() {
      setSprites(state.sprites.map(s => ({ ...s })));
    }

    // ── Single-block executor ────────────────────────────────────────────────
    async function execBlock(spriteId, block) {
      if (state.stopped || state.aborted.has(spriteId)) return;
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
            if (state.stopped || state.aborted.has(spriteId)) return;
            await execBlocks(spriteId, block.blocks || []);
          }
          break;
        }

        case "SAY":
        case "THINK": {
          // Show speech bubble, wait, then clear it.
          sp.speechBubble = { text: block.message, kind: block.type.toLowerCase() };
          flush();
          await sleep(Number(block.seconds) * 1000);
          if (state.stopped || state.aborted.has(spriteId)) return;
          sp.speechBubble = null;
          flush();
          break;
        }

        default: break;
      }
    }

    async function execBlocks(spriteId, blocks) {
      for (const block of blocks) {
        if (state.stopped || state.aborted.has(spriteId)) return;
        await execBlock(spriteId, block);
      }
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

          // Signal running loops to exit at next await
          state.aborted.add(movedId);
          state.aborted.add(other.id);

          // Re-launch with swapped blocks after both loops have had time to exit
          setTimeout(() => {
            if (state.stopped) return;
            state.aborted.delete(movedId);
            state.aborted.delete(other.id);
            Promise.all([
              execBlocks(movedId, moved.blocks),
              execBlocks(other.id, other.blocks),
            ]);
          }, 150);
        }
      }
    }

    // Kick off all sprite loops concurrently; mark play as done when all finish.
    Promise.all(state.sprites.map(s => execBlocks(s.id, s.blocks))).then(() => {
      if (!state.stopped) setIsPlaying(false);
    });
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
    <div className="bg-blue-100 pt-6 font-sans">
      <div className="h-screen overflow-hidden flex flex-row">

        <div className="flex-1 h-screen overflow-hidden flex flex-row bg-white border-t border-r border-gray-200 rounded-tr-xl mr-2">
          <Sidebar />
          <MidArea
            sprite={activeSpriteDef}
            onAddBlock={block => addBlock(activeSpriteDef?.id, block)}
            onUpdateBlock={(blockId, patch) => updateBlock(activeSpriteDef?.id, blockId, patch)}
            onDeleteBlock={blockId => deleteBlock(activeSpriteDef?.id, blockId)}
            onAddInnerBlock={(parentId, block) => addInnerBlock(activeSpriteDef?.id, parentId, block)}
          />
        </div>

        <div className="w-2/5 h-screen overflow-hidden flex flex-col bg-white border-t border-l border-gray-200 rounded-tl-xl ml-2">
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
