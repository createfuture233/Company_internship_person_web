import { useRef } from "react";
import VariableProximity from "./VariableProximity";

/**
 * 邻近效应标题组件
 * 基于 VariableProximity 实现的交互式标题，鼠标悬停时字重会动态变化
 */
export default function ProximityHeading({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null); // 容器引用

  return (
    <span className="proximity-title" ref={ref}>
      <VariableProximity
        label={label}
        containerRef={ref}
        radius={100}                    // 影响半径为 100px
        falloff="linear"                // 使用线性衰减
        fromFontVariationSettings="'wght' 450"  // 起始字重 450
        toFontVariationSettings="'wght' 700"    // 目标字重 700
      />
    </span>
  );
}