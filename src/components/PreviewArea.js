import React from "react";
import CatSprite from "./CatSprite";

export default function PreviewArea({
  sprites, activeSprite, setActiveSprite,
  isPlaying, onPlay,
  onAddSprite, onRemoveSprite,
  STAGE_W, STAGE_H, COLORS,
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar  */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-none">
        <button
          onClick={onPlay}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-sm font-semibold shadow-sm transition-colors
            ${isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
        >
          {isPlaying ? "■ Stop" : "▶ Play"}
        </button>
        {isPlaying && (
          <span className="text-xs text-gray-400 animate-pulse">animating…</span>
        )}
      </div>

      {/* Stage */}
      <div className="flex-1 flex items-center justify-center bg-white overflow-hidden p-2">
        <div
          className="relative bg-white border-2 border-gray-200 rounded overflow-hidden flex-none"
          style={{ width: STAGE_W, height: STAGE_H, maxWidth: "100%", maxHeight: "100%" }}
        >
          {sprites.map(sprite => (
            <SpriteOnStage
              key={sprite.id}
              sprite={sprite}
              STAGE_W={STAGE_W}
              STAGE_H={STAGE_H}
              COLORS={COLORS}
              isActive={sprite.id === activeSprite}
              onClick={() => setActiveSprite(sprite.id)}
            />
          ))}

          {/* Crosshair at origin */}
          <div className="absolute pointer-events-none opacity-10"
            style={{ left: STAGE_W / 2 - 0.5, top: 0, width: 1, height: "100%", background: "#999" }} />
          <div className="absolute pointer-events-none opacity-10"
            style={{ top: STAGE_H / 2 - 0.5, left: 0, height: 1, width: "100%", background: "#999" }} />
        </div>
      </div>

      {/* Sprite list */}
      <div className="border-t border-gray-200 p-2 bg-gray-50 flex-none">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sprites</div>
        <div className="flex flex-wrap gap-2 items-start">

          {sprites.map(sprite => (
            <SpriteThumbnail
              key={sprite.id}
              sprite={sprite}
              COLORS={COLORS}
              isActive={sprite.id === activeSprite}
              onClick={() => setActiveSprite(sprite.id)}
              onDelete={sprites.length > 1 ? () => onRemoveSprite(sprite.id) : null}
            />
          ))}

          <button
            onClick={onAddSprite}
            className="w-14 h-16 rounded border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-400 flex flex-col items-center justify-center text-xl transition-colors"
            title="Add new sprite"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SpriteOnStage({ sprite, STAGE_W, STAGE_H, COLORS, isActive, onClick }) {
  const cssLeft = STAGE_W / 2 + sprite.x;
  const cssTop  = STAGE_H / 2 - sprite.y;

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: cssLeft,
        top: cssTop,
        transform: `translate(-50%, -50%) rotate(${sprite.direction}deg)`,
        zIndex: isActive ? 10 : 5,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {/* Speech / thought bubble */}
      {sprite.speechBubble && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "50%",
            transform: "translateX(-50%) rotate(-" + sprite.direction + "deg)",
            background: "white",
            border: "2px solid #ddd",
            borderRadius: 8,
            padding: "3px 8px",
            fontSize: 11,
            whiteSpace: "nowrap",
            zIndex: 30,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {sprite.speechBubble.kind === "think" ? "💭 " : "💬 "}
          {sprite.speechBubble.text}
        </div>
      )}

      {/* Sprite body — coloured disc */}
      <div style={{ position: "relative", width: 52, height: 52 }}>
        <div style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          background: COLORS[sprite.colorIdx % COLORS.length],
          opacity: 0.35,
          border: isActive ? "3px solid #3B82F6" : "2px solid rgba(0,0,0,0.08)",
          boxShadow: isActive ? "0 0 0 3px #93C5FD" : "none",
        }} />

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CatSprite width={44} height={46} />
        </div>
      </div>

      {/* Sprite name label */}
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: `translateX(-50%) rotate(-${sprite.direction}deg)`,
          marginTop: 2,
          fontSize: 9,
          color: "#555",
          whiteSpace: "nowrap",
          background: "rgba(255,255,255,0.8)",
          borderRadius: 2,
          padding: "0 2px",
        }}
      >
        {sprite.name}
      </div>
    </div>
  );
}

// SpriteThumbnail sprite list panel.

function SpriteThumbnail({ sprite, COLORS, isActive, onClick, onDelete }) {
  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col items-center p-1 rounded cursor-pointer border-2 w-14 transition-all
        ${isActive ? "border-blue-500 bg-blue-50" : "border-transparent hover:border-gray-300 bg-white"}`}
    >
      {/* Colour disc behind cat */}
      <div style={{ position: "relative", width: 36, height: 36 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: COLORS[sprite.colorIdx % COLORS.length], opacity: 0.35,
        }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CatSprite width={30} height={32} />
        </div>
      </div>

      <span className="text-xs text-gray-600 mt-0.5 truncate w-full text-center">{sprite.name}</span>

      {onDelete && (
        <button
          className="absolute top-0 right-0 w-4 h-4 text-xs text-gray-400 hover:text-red-500 leading-none flex items-center justify-center"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Remove sprite"
        >
          ✕
        </button>
      )}
    </div>
  );
}
