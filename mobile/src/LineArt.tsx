import React from "react";
import Svg, { Path, Circle, G } from "react-native-svg";

export function ActionDrawing({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    task: "M9 6 7 5 5 7v21l4-2 4 2 4-2 4 2 4-2V7l-3-2-3 2-3-2-3 2ZM10 13l2 2 4-5M10 21h9M20 10h1",
    grocery: "M5 12h23l-3 16H8ZM10 12l4-7M23 12l-4-7M12 17l1 7M21 17l-1 7",
    expense: "M5 10V7l20-3v6M5 10h23v18H5ZM28 15h-9v8h9M23 19h1",
    hangout: "M4 7h21v15H13l-6 6v-6H4ZM10 12h9M10 17h5M28 11h3v16h-4l-4 4v-5",
  };
  return (
    <Svg width={29} height={32} viewBox="0 0 34 34">
      <Path
        d={paths[kind]}
        fill="none"
        stroke="#d0dadd"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SpaceDrawing() {
  return (
    <Svg width={89} height={76} viewBox="0 0 110 90">
      <G
        fill="none"
        stroke="#d1dfdc"
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M15 68q18-6 33 0V25q-15-7-33-1ZM48 68q19-7 36-1V23q-18-5-36 2M19 27q15-4 25 0M20 34l18-1M20 40h16M20 46h9M52 30q13-5 27-3M53 62q15-5 25-2M12 28 8 31v42q24-5 40 1 23-6 41-1V28l-5-2" />
        <Path d="M64 55V42q-14 0-13-11 12 0 13 11 0-17 12-20 5 13-12 20M61 55h11l-2 7h-7ZM88 12v13M82 18h12M27 7v9M23 12h9" />
        <Circle cx={95} cy={52} r={3} />
        <Path d="m93 73 2 4 5 1-5 2-2 5-2-5-5-2 5-1Z" />
      </G>
    </Svg>
  );
}
