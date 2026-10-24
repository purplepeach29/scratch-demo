import React from "react";
import Icon from "./Icon";

const CATEGORIES = [
  {
    name: "Motion",
    color: "bg-blue-500",
    blocks: [
      {
        type: "MOVE_STEPS",
        defaults: { steps: 10 },
        label: () => <><span>Move</span><Chip>10</Chip><span>steps</span></>,
      },
      {
        type: "TURN_DEGREES",
        defaults: { degrees: 15, dir: "right" },
        label: () => (
          <><span>Turn</span><Icon name="redo" size={11} className="text-white" /><Chip>15</Chip><span>deg</span></>
        ),
      },
      {
        type: "GO_TO_XY",
        defaults: { x: 0, y: 0 },
        label: () => <><span>Go to</span><Chip>x:0</Chip><Chip>y:0</Chip></>,
      },
    ],
  },
  {
    name: "Control",
    color: "bg-red-400",
    blocks: [
      {
        type: "REPEAT",
        // blocks[] is the empty inner list; MidArea renders a nested drop zone
        defaults: { times: 10, blocks: [] },
        label: () => <><span>Repeat</span><Chip>10</Chip><span>times</span></>,
      },
    ],
  },
  {
    name: "Looks",
    color: "bg-purple-500",
    blocks: [
      {
        type: "SAY",
        defaults: { message: "Hello!", seconds: 2 },
        label: () => <><span>Say</span><Chip>"Hello!"</Chip><span>for</span><Chip>2</Chip><span>s</span></>,
      },
      {
        type: "THINK",
        defaults: { message: "Hmm...", seconds: 2 },
        label: () => <><span>Think</span><Chip>"Hmm..."</Chip><span>for</span><Chip>2</Chip><span>s</span></>,
      },
    ],
  },
];

// White pill used inside block labels to hint at editable parameter values.
function Chip({ children }) {
  return (
    <span className="inline-block bg-white text-gray-700 rounded px-1 mx-0.5 text-xs font-semibold leading-4"
      style={{ minWidth: "1.4rem", textAlign: "center" }}>
      {children}
    </span>
  );
}

export default function Sidebar() {

  // Serialise the block's type + defaults into dataTransfer.
  // MidArea's onDrop reads this, assigns a fresh id, and appends to the sprite.
  function onDragStart(e, entry) {
    const block = { type: entry.type, ...entry.defaults };
    e.dataTransfer.setData("block", JSON.stringify(block));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div className="w-full sm:w-44 lg:w-52 flex-none h-full overflow-y-auto flex flex-col p-2 border-b sm:border-b-0 sm:border-r border-gray-200 bg-gray-50">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
        Blocks
      </div>

      {/* Two columns on phones */}
      <div className="grid grid-cols-2 gap-x-2 sm:block">
        {CATEGORIES.map(cat => (
          <div key={cat.name} className="mb-3">
            <div className="text-xs font-bold text-gray-600 mb-1 px-1">{cat.name}</div>

            {cat.blocks.map(entry => (
              <div
                key={entry.type}
                draggable
                onDragStart={e => onDragStart(e, entry)}
                className={`${cat.color} text-white flex flex-row items-center flex-wrap gap-1 px-2 py-1.5 mb-1 rounded text-xs cursor-grab active:cursor-grabbing select-none shadow-sm hover:brightness-110 transition-all`}
              >
                <entry.label />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden sm:block mt-auto pt-2 text-xs text-gray-400 text-center">
        ← drag blocks to the script →
      </div>
    </div>
  );
}
