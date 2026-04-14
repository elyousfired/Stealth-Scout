import React from 'react';

interface HistoryPoint {
  vwap: number;
  ema: number;
  price: number;
}

interface StructureVisualizerProps {
  history: HistoryPoint[];
  vwapMax: number;
  vwapMin: number;
  width?: number;
  height?: number;
}

const StructureVisualizer: React.FC<StructureVisualizerProps> = ({ 
  history, 
  vwapMax, 
  vwapMin, 
  width = 120, 
  height = 40 
}) => {
  if (!history || history.length < 2) return <div style={{ width, height, background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}></div>;

  // Calculate global min/max for scaling
  const allValues = history.flatMap(h => [h.vwap, h.ema, h.price]).concat([vwapMax, vwapMin]);
  const minVal = Math.min(...allValues) * 0.999; 
  const maxVal = Math.max(...allValues) * 1.001;
  const range = maxVal - minVal || 1;

  const scaleY = (val: number) => height - ((val - minVal) / range) * height;
  const scaleX = (index: number) => (index / (history.length - 1)) * width;

  // Generate paths
  const vwapPath = history.map((p, i) => `${scaleX(i)},${scaleY(p.vwap)}`).join(' ');
  const emaPath = history.map((p, i) => `${scaleX(i)},${scaleY(p.ema)}`).join(' ');
  const pricePath = history.map((p, i) => `${scaleX(i)},${scaleY(p.price)}`).join(' ');

  const yMax = scaleY(vwapMax);
  const yMin = scaleY(vwapMin);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      {/* Weekly Structure Boundaries */}
      <line x1={0} y1={yMax} x2={width} y2={yMax} stroke="#c084fc" strokeWidth="1" strokeDasharray="3,2" />
      {/* Smart Label Positioning to avoid overlap */}
      {(() => {
        const overlap = Math.abs(yMax - yMin) < 12;
        const finalYMax = overlap ? (yMax < yMin ? yMax - 6 : yMax + 6) : yMax;
        const finalYMin = overlap ? (yMin > yMax ? yMin + 6 : yMin - 6) : yMin;
        
        return (
          <>
            <text 
              x={width + 5} 
              y={finalYMax > 12 ? finalYMax + 3 : 10} 
              fill="#c084fc" 
              fontSize="9" 
              fontWeight="800" 
              style={{ textShadow: '0 0 5px rgba(192, 132, 252, 0.4)' }}
            >
              MAX {vwapMax < 1 ? vwapMax.toFixed(6) : vwapMax.toFixed(2)}
            </text>

            <line x1={0} y1={yMin} x2={width} y2={yMin} stroke="#fb7185" strokeWidth="1" strokeDasharray="3,2" />
            <text 
              x={width + 5} 
              y={finalYMin < height - 12 ? finalYMin + 3 : height - 4} 
              fill="#fb7185" 
              fontSize="9" 
              fontWeight="800" 
              style={{ textShadow: '0 0 5px rgba(251, 113, 133, 0.4)' }}
            >
              MIN {vwapMin < 1 ? vwapMin.toFixed(6) : vwapMin.toFixed(2)}
            </text>
          </>
        );
      })()}

      {/* EMA 50 Line */}
      <polyline
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
        strokeLinejoin="round"
        points={emaPath}
      />

      {/* Price Line (Amber/Yellow) */}
      <polyline
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.5"
        strokeLinejoin="round"
        points={pricePath}
        opacity="0.8"
      />

      {/* Daily VWAP Line */}
      <polyline
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2.5"
        strokeLinejoin="round"
        points={vwapPath}
      />

      {/* Current Pulse Point */}
      <circle cx={width} cy={scaleY(history[history.length-1].vwap)} r="2.5" fill="#3b82f6" />
      <circle cx={width} cy={scaleY(history[history.length-1].price)} r="2" fill="#fbbf24" />
    </svg>
  );
};

export default StructureVisualizer;
