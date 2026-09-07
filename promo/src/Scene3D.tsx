import {ThreeCanvas} from '@remotion/three';
import {useCurrentFrame} from 'remotion';

// The official template-three's ThreeCanvas / frame-driven scene pattern.
// This sculpture represents independent inputs converging around one decision.
export const Scene3D = ({compact = false}: {compact?: boolean}) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const palette = ['#b5a0ff', '#c9baff', '#b9f4dd', '#8adac7', '#ece6ff'];
  return (
    <ThreeCanvas width={compact ? 760 : 1100} height={compact ? 760 : 1080}
      camera={{position: [0, 0, 9], fov: 38}} gl={{alpha: true, antialias: true}}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={3} color="#eae1ff" />
      <pointLight position={[-4, -2, 3]} intensity={65} color="#9cead0" />
      <group rotation={[0.25 + Math.sin(t * 0.24) * 0.12, t * 0.14, -0.12]}>
        <mesh rotation={[t * 0.1, t * 0.2, 0]}>
          <octahedronGeometry args={[0.91, 0]} />
          <meshStandardMaterial color="#b8a4ff" metalness={0.72} roughness={0.22} />
        </mesh>
        {[0, 1, 2].map((i) => <mesh key={i} rotation={[Math.PI / 2 + i * 0.36, i * 0.62, t * 0.08]}>
          <torusGeometry args={[1.78 + i * 0.22, 0.018, 8, 100]} />
          <meshStandardMaterial color={i === 1 ? '#a2e4cd' : '#776799'} metalness={0.5} roughness={0.3} />
        </mesh>)}
        {palette.map((color, i) => {
          const angle = i * Math.PI * 2 / 5 + t * 0.09;
          return <group key={color} position={[Math.cos(angle) * 2.13, Math.sin(angle) * 1.8, Math.sin(angle * 2) * 0.7]} rotation={[0.15, -0.35 + i * 0.15, angle * 0.12]}>
            <mesh>
              <boxGeometry args={[0.72, 0.98, 0.12]} />
              <meshStandardMaterial color={color} metalness={0.45} roughness={0.24} />
            </mesh>
            {[0, 1, 2].map((j) => <mesh key={j} position={[-0.04, 0.21 - j * 0.17, 0.065]}>
              <boxGeometry args={[j === 2 ? 0.26 : 0.43, 0.025, 0.01]} />
              <meshBasicMaterial color="#27302e" />
            </mesh>)}
          </group>;
        })}
      </group>
    </ThreeCanvas>
  );
};
