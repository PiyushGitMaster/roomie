import { Line } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useScroll } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BoxGeometry, Color, MeshBasicMaterial, Object3D } from 'three'
import type { Group, InstancedMesh } from 'three'

const buildings = [
  { x: -6.1, width: 1.7, height: 3.9, depth: -1.3 },
  { x: -4.1, width: 1.9, height: 6.7, depth: -.7 },
  { x: -2, width: 1.7, height: 5.3, depth: -1.6 },
  { x: .1, width: 2, height: 8.1, depth: -1 },
  { x: 2.3, width: 1.7, height: 5.8, depth: -.8 },
  { x: 4.3, width: 1.9, height: 7.1, depth: -1.4 },
  { x: 6.3, width: 1.7, height: 4.4, depth: -1 },
]

function NightCity() {
  const cameraRig = useRef<Group>(null)
  const { scrollYProgress } = useScroll()
  const windows = useMemo(() => {
    const positions: [number, number, number][] = []
    buildings.forEach((building, buildingIndex) => {
      for (let row = 0; row < Math.floor(building.height / .62); row += 1) {
        for (let column = 0; column < 3; column += 1) {
          if ((row * 3 + column + buildingIndex) % 4 === 1) continue
          positions.push([
            building.x - building.width / 2 + .34 + column * .52,
            .38 + row * .62,
            building.depth + .13,
          ])
        }
      }
    })
    return positions
  }, [])
  const windowGeometry = useMemo(() => new BoxGeometry(.2, .21, .035), [])
  const windowMaterial = useMemo(() => new MeshBasicMaterial({ color: '#b5ffc7' }), [])
  const lights = useRef<InstancedMesh>(null)

  useEffect(() => {
    if (!lights.current) return
    const transform = new Object3D()
    windows.forEach((position, index) => {
      transform.position.set(...position)
      transform.updateMatrix()
      lights.current?.setMatrixAt(index, transform.matrix)
    })
    lights.current.instanceMatrix.needsUpdate = true
    const palette = ['#39ff88', '#ff2e93', '#3d8bff', '#b5ffc7']
    windows.forEach((_position, index) => lights.current?.setColorAt(index, new Color(palette[(index * 7) % palette.length])))
    if (lights.current.instanceColor) lights.current.instanceColor.needsUpdate = true
  }, [windows])

  useFrame(({ camera }) => {
    const progress = scrollYProgress.get()
    if (cameraRig.current) {
      cameraRig.current.position.x = Math.sin(progress * Math.PI * 1.3) * .7
      cameraRig.current.position.y = -progress * .5
    }
    camera.position.z = 12 - progress * 1.4
  })

  return <group ref={cameraRig}>
    {buildings.map(({ x, width, height, depth }, index) => <mesh key={x} position={[x, height / 2, depth]}>
      <boxGeometry args={[width, height, .45]} />
      <meshBasicMaterial color={index % 2 ? '#111e16' : '#101814'} />
    </mesh>)}
    <instancedMesh ref={lights} args={[windowGeometry, windowMaterial, windows.length]} />
    <Line points={[[-4.7, 3.5, -.2], [-.3, 5.2, -.15], [4.9, 4.7, -.1]]} color="#ff2e93" lineWidth={1} transparent opacity={.65} />
    <mesh position={[-4.7, 3.5, -.1]}><sphereGeometry args={[.07, 8, 8]} /><meshBasicMaterial color="#39ff88" /></mesh>
    <mesh position={[-.3, 5.2, -.1]}><sphereGeometry args={[.07, 8, 8]} /><meshBasicMaterial color="#39ff88" /></mesh>
    <mesh position={[4.9, 4.7, -.1]}><sphereGeometry args={[.07, 8, 8]} /><meshBasicMaterial color="#39ff88" /></mesh>
  </group>
}

export default function CityScene() {
  const [visible, setVisible] = useState(false)
  const sceneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = sceneRef.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return <div className="city-canvas" ref={sceneRef} aria-hidden="true">
    <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 1.35]} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }} camera={{ position: [0, 0, 12], fov: 40 }}>
      <NightCity />
    </Canvas>
  </div>
}
