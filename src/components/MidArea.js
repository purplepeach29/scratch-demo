import React from "react";

const TYPE_COLOR = {
  MOVE_STEPS:   "bg-blue-500",
  TURN_DEGREES: "bg-blue-500",
  GO_TO_XY:     "bg-blue-500",
  REPEAT:       "bg-red-400",
  SAY:          "bg-purple-500",
  THINK:        "bg-purple-500",
};


export default function MidArea({ sprite, onAddBlock, onUpdateBlock, onDeleteBlock, onAddInnerBlock }) {
  if (!sprite) {
    return (
      <div className="flex-1 h-full flex items-center justify-center text-gray-400 text-sm">
        No sprite selected
      </div>
    );
  }

  // Parse the dragged block JSON and append it to the sprite's top-level list.
  function onDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("block");
    if (!raw) return;
    try { onAddBlock(JSON.parse(raw)); } catch {}
  }

  // Used by nested REPEAT drop zones — adds to the inner list, not the outer one.
  // stopPropagation prevents the outer onDrop from also firing.
  function onInnerDrop(e, repeatBlockId) {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData("block");
    if (!raw) return;
    try { onAddInnerBlock(repeatBlockId, JSON.parse(raw)); } catch {}
  }

  return (
    <div
      className="flex-1 h-full overflow-auto p-3 bg-gray-50"
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs font-semibold text-blue-700">
        {/* <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> */}
        {sprite.name}
      </div>

      {/* Empty state */}
      {sprite.blocks.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-400 text-sm">
          Drag blocks here to build the script
        </div>
      )}

      {/* Block list — each item is a BlockCard (possibly recursive for REPEAT) */}
      <div className="flex flex-col gap-1">
        {sprite.blocks.map(block => (
          <BlockCard
            key={block.id}
            block={block}
            onUpdate={onUpdateBlock}
            onDelete={onDeleteBlock}
            onInnerDrop={onInnerDrop}
            onAddInnerBlock={onAddInnerBlock}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BlockCard ────────────────────────────────────────────────────────────────
// Renders one block (including its inline editable params).
// For REPEAT, also renders an indented inner drop zone + recursive children.

function BlockCard({ block, onUpdate, onDelete, onInnerDrop, onAddInnerBlock }) {
  const color = TYPE_COLOR[block.type] || "bg-gray-400";
  const isRepeat = block.type === "REPEAT";

  return (
    <div className={`rounded text-white text-xs ${isRepeat ? "border-l-4 border-red-600" : ""}`}>

      {/* ── Block header row ──────────────────────────────────────────────── */}
      <div className={`${color} flex items-center gap-1 px-2 py-1.5 ${isRepeat ? "rounded-t" : "rounded"}`}>

        <BlockLabel block={block} />

        {/* Inline param inputs — clicking stops propagation so dragging the card
            by accident doesn't start a drag while the user is typing */}
        <div className="flex items-center gap-1 ml-1" onClick={e => e.stopPropagation()}>
          <BlockInputs block={block} onUpdate={onUpdate} />
        </div>

        <button
          className="ml-auto pl-2 opacity-60 hover:opacity-100 leading-none"
          onClick={() => onDelete(block.id)}
          title="Remove block"
        >
          ✕
        </button>
      </div>

      {/* REPEAT inner area*/}
      {isRepeat && (
        <>
          {/* Inner drop zone */}
          <div
            className="ml-3 pl-2 py-1 bg-red-50 border-red-300 min-h-8"
            onDragOver={e => e.preventDefault()}
            onDrop={e => onInnerDrop(e, block.id)}
          >
            {(!block.blocks || block.blocks.length === 0) && (
              <div className="text-gray-800 text-xs italic py-0.5">drop inner blocks here</div>
            )}

            {(block.blocks || []).map(inner => (
              <BlockCard
                key={inner.id}
                block={inner}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onInnerDrop={onInnerDrop}
                onAddInnerBlock={onAddInnerBlock}
              />
            ))}
          </div>

          {/* REPEAT closing jaw */}
          <div className={`${color} h-2 rounded-b`} />
        </>
      )}
    </div>
  );
}

// ─── BlockLabel ───────────────────────────────────────────────────────────────
// The fixed text part of a block.

function BlockLabel({ block }) {
  const labels = {
    MOVE_STEPS:   "Move",
    TURN_DEGREES: "Turn",
    GO_TO_XY:     "Go to",
    REPEAT:       "Repeat",
    SAY:          "Say",
    THINK:        "Think",
  };
  return <span className="font-semibold whitespace-nowrap">{labels[block.type] ?? block.type}</span>;
}

// ─── BlockInputs ──────────────────────────────────────────────────────────────
// Renders the editable param fields for each block type.

function BlockInputs({ block, onUpdate }) {
  const Inp = ({ field, type = "number", width = "w-12" }) => (
    <input
      type={type}
      className={`${width} text-xs text-gray-800 bg-white border border-gray-200 rounded px-1 py-0.5`}
      value={block[field] ?? ""}
      onChange={e =>
        onUpdate(block.id, { [field]: type === "number" ? Number(e.target.value) : e.target.value })
      }
    />
  );

  switch (block.type) {
    case "MOVE_STEPS":
      return <><Inp field="steps" /><span>steps</span></>;

    case "TURN_DEGREES":
      return (
        <>
          <select
            className="text-xs text-gray-800 bg-white border border-gray-200 rounded px-1 py-0.5"
            value={block.dir}
            onChange={e => onUpdate(block.id, { dir: e.target.value })}
          >
            <option value="right">↻ right</option>
            <option value="left">↺ left</option>
          </select>
          <Inp field="degrees" />
          <span>°</span>
        </>
      );

    case "GO_TO_XY":
      return <><span>x:</span><Inp field="x" /><span>y:</span><Inp field="y" /></>;

    case "REPEAT":
      return <><Inp field="times" /><span>times</span></>;

    case "SAY":
    case "THINK":
      return (
        <>
          <Inp field="message" type="text" width="w-20" />
          <span>for</span>
          <Inp field="seconds" />
          <span>s</span>
        </>
      );

    default:
      return null;
  }
}
