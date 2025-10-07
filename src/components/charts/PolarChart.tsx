import { useEffect, useRef, useMemo } from 'react';

interface PolarChartProps {
  data: number[][];
  verticalAngles: number[];
  horizontalAngles: number[];
}

export function PolarChart({ data, verticalAngles, horizontalAngles }: PolarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate max intensity for normalization
  const maxIntensity = useMemo(() => {
    let max = 0;
    data.forEach(slice => {
      slice.forEach(val => {
        if (val > max) max = val;
      });
    });
    return max;
  }, [data]);

  // Find beam angle (where intensity drops to 50% of peak)
  const beamAngle = useMemo(() => {
    const centerSlice = data[0] || [];
    const halfMax = maxIntensity * 0.5;
    let angle = 0;
    for (let i = 0; i < centerSlice.length; i++) {
      if (centerSlice[i] < halfMax) {
        angle = verticalAngles[i] || 0;
        break;
      }
    }
    return angle * 2; // Full beam angle
  }, [data, verticalAngles, maxIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw concentric circles (grid) with labels
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#666677';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const maxCd = Math.ceil(maxIntensity / 10) * 10; // Round up to nearest 10
    for (let i = 1; i <= 5; i++) {
      const r = (radius / 5) * i;
      const cdValue = (maxCd / 5) * i;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Label on left side
      ctx.fillText(cdValue.toFixed(0), centerX - r - 5, centerY);
    }

    // Draw radial lines for angles (every 15 degrees from 0 to 180)
    ctx.strokeStyle = '#333344';
    ctx.lineWidth = 0.5;
    for (let angle = 0; angle <= 180; angle += 15) {
      const rad = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      
      // For Type C photometry: 0° is at top (nadir/downward)
      // We need to rotate so 0° appears at top
      const displayRad = rad - Math.PI / 2; // Rotate 90° counter-clockwise
      ctx.lineTo(
        centerX + Math.cos(displayRad) * radius,
        centerY + Math.sin(displayRad) * radius
      );
      ctx.stroke();
      
      // Draw symmetric line for 360° representation
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX - Math.cos(displayRad) * radius,
        centerY - Math.sin(displayRad) * radius
      );
      ctx.stroke();
    }

    // Draw angle labels (0°, 15°, 30°, 45°, 60°, 75°, 90°)
    ctx.fillStyle = '#888899';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let angle = 0; angle <= 90; angle += 15) {
      const rad = (angle * Math.PI) / 180 - Math.PI / 2;
      const labelRadius = radius + 25;
      
      // Top half (right side)
      const x1 = centerX + Math.cos(rad) * labelRadius;
      const y1 = centerY + Math.sin(rad) * labelRadius;
      ctx.fillText(`${angle}°`, x1, y1);
      
      // Bottom half (left side) - mirror
      const x2 = centerX - Math.cos(rad) * labelRadius;
      const y2 = centerY - Math.sin(rad) * labelRadius;
      ctx.fillText(`${angle}°`, x2, y2);
    }

    // Plot C-planes (vertical slices through luminaire)
    // C0-C180 plane (horizontal angle 0° and 180°)
    // C90-C270 plane (horizontal angle 90° and 270°)
    
    const planesToPlot = [
      { hIndex: 0, color: 'rgba(218, 194, 107, 0.9)', label: 'C0-C180', strokeColor: '#dac26b' },
      { hIndex: horizontalAngles.findIndex(a => Math.abs(a - 90) < 5) || Math.floor(horizontalAngles.length / 4), 
        color: 'rgba(170, 162, 105, 0.7)', label: 'C90-C270', strokeColor: '#aaa269' }
    ];

    planesToPlot.forEach((plane, pIdx) => {
      if (plane.hIndex < 0 || plane.hIndex >= data.length) return;
      
      const slice = data[plane.hIndex] || [];
      
      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      
      // Plot from 0° to 180° (right side)
      slice.forEach((intensity, vIdx) => {
        if (vIdx >= verticalAngles.length) return;
        const angle = verticalAngles[vIdx];
        if (angle > 180) return;
        
        const rad = (angle * Math.PI) / 180 - Math.PI / 2; // Type C: 0° at top
        const normalizedIntensity = Math.min(intensity / maxCd, 1);
        const r = normalizedIntensity * radius;
        
        const x = centerX + Math.cos(rad) * r;
        const y = centerY + Math.sin(rad) * r;
        
        if (vIdx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      // Mirror for 180° to 360° (left side)
      for (let vIdx = slice.length - 1; vIdx >= 0; vIdx--) {
        if (vIdx >= verticalAngles.length) continue;
        const angle = verticalAngles[vIdx];
        if (angle > 180) continue;
        
        const rad = (angle * Math.PI) / 180 - Math.PI / 2;
        const normalizedIntensity = Math.min(slice[vIdx] / maxCd, 1);
        const r = normalizedIntensity * radius;
        
        const x = centerX - Math.cos(rad) * r;
        const y = centerY - Math.sin(rad) * r;
        
        ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      
      // Fill with gradient
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, plane.color);
      gradient.addColorStop(1, plane.color.replace(/[\d.]+\)$/, '0.2)'));
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Stroke outline
      ctx.strokeStyle = plane.strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw center point
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw axis labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 0° label (top)
    ctx.fillText('0°', centerX, centerY - radius - 45);
    ctx.fillText('(Nadir)', centerX, centerY - radius - 32);
    
    // 180° label (bottom - not typically shown for downlights)
    ctx.fillText('90°', centerX + radius + 30, centerY);
    ctx.fillText('90°', centerX - radius - 30, centerY);

  }, [data, verticalAngles, horizontalAngles, maxIntensity]);

  return (
    <div className="bg-[#1a1a2e] p-6 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Polar plot</h3>
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          className="max-w-full h-auto"
        />
      </div>
      <div className="mt-4 text-center space-y-1">
        <p className="text-sm text-gray-400">
          Beam angle: <span className="text-yellow-400 font-semibold">{beamAngle.toFixed(1)}°</span>
        </p>
        <p className="text-xs text-gray-500">
          <span className="text-yellow-400">━━</span> C0-C180 · 
          <span className="text-yellow-300/70 ml-2">━━</span> C90-C270
        </p>
        <p className="text-xs text-gray-600 mt-2">LOR: 100%</p>
      </div>
    </div>
  );
}