import { Canvas, useFrame, useLoader } from "@react-three/fiber"
import { Environment, RoundedBox } from "@react-three/drei"
import { ReactNode, useContext, useRef } from "react"

import "./index.css"
import { DoubleSide, Group, MathUtils, Mesh, TextureLoader } from "three"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { KernelSize } from "postprocessing"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"

import envMap from "./studio_small_08_1k.hdr"
import screenAlphaMap from "./screen_alpha.png"
import boardGLB from "./board.glb"

import {
  FrontMeshPrimitive,
  BackMeshPrimitive,
  ConcavePrimitive,
  ConvexPrimitive,
  DpadPrimitive,
  ShoulderButtonPrimitive,
  PowerButtonPrimitive,
  VolumeButtonPrimitive,
} from "./stlPrimitives"
import { BodyColourContext, ButtonsColourContext } from "./colourContext"
import { PocketColour } from "../../types"

type PocketProps = {
  move?: "none" | "spin" | "back-and-forth"
  screenMaterial?: ReactNode
  children?: ReactNode
}

type PartialColourMap = Partial<Record<PocketColour, string>>
type PartialScaleMap = Partial<Record<PocketColour, number>>

const LIGHTING_SCALE: PartialScaleMap = {
  black: 5,
  white: 1.5,
  glow: 0,
}

const SWAY_SPEED = 0.2

export const Pocket = ({
  move = "none",
  screenMaterial,
  children,
}: PocketProps) => {
  return (
    <Canvas
      shadows
      className="three-pocket"
      camera={{ fov: 50, position: [0, 0, 42] }}
    >
      <Environment files={envMap} />
      <Lights />
      <Body move={move} screenMaterial={screenMaterial} />
      {/* <OrbitControls enablePan={false} /> */}
      {/* <Stats showPanel={0} /> */}
      <GlowBloom />
      {children && children}
    </Canvas>
  )
}

const GlowBloom = () => {
  const colour = useContext(BodyColourContext)

  return (
    <EffectComposer enabled={colour === "glow"}>
      <Bloom
        intensity={0.05}
        luminanceThreshold={0.8}
        kernelSize={KernelSize.HUGE}
        luminanceSmoothing={0.025}
      />
    </EffectComposer>
  )
}

const Lights = () => {
  const colour = useContext(BodyColourContext)
  const scale = LIGHTING_SCALE[colour] || LIGHTING_SCALE["white"] || 1

  return (
    <>
      <ambientLight intensity={1 * scale} />
      <directionalLight position={[0, 200, 0]} intensity={5 * scale} />
      <pointLight position={[20, 10, 20]} intensity={1.5 * scale} castShadow />
      <pointLight position={[10, 20, 10]} intensity={1 * scale} castShadow />
    </>
  )
}

const Body = ({
  move,
  screenMaterial,
}: Pick<PocketProps, "move" | "screenMaterial">) => {
  const bodyColour = useContext(BodyColourContext)
  const buttonsColour = useContext(ButtonsColourContext)

  const groupRef = useRef<THREE.Group>(null)
  const speedRef = useRef<number>(SWAY_SPEED)
  useFrame((_, delta) => {
    if (groupRef.current && speedRef.current) {
      const speed = speedRef.current
      switch (move) {
        case "spin":
          groupRef.current.rotateY(-0.6 * speed * delta)
          break
        case "back-and-forth":
          groupRef.current.rotateY(-0.6 * speed * delta)
          if (groupRef.current.rotation.y > 0.4) {
            speedRef.current = SWAY_SPEED
          } else if (groupRef.current.rotation.y < -0.4) {
            speedRef.current = -SWAY_SPEED
          }
          break
        default:
          break
      }
    }
  })

  return (
    <group ref={groupRef} rotation={[0, move === "spin" ? 1 : 0, -0.2]}>
      <mesh
        scale={[0.2, 0.2, 0.2]}
        rotation={[0, Math.PI, 0]}
        position={[0, 0, 1.05]}
        receiveShadow
      >
        <FrontMeshPrimitive />
        {bodyColour.startsWith("trans_") ? (
          <TransparentMaterial />
        ) : (
          <Material />
        )}
      </mesh>
      <mesh
        scale={[0.2, 0.2, 0.2]}
        rotation={[0, 0, 0]}
        position={[0, 0, -1.66]}
        receiveShadow
      >
        <BackMeshPrimitive />
        {bodyColour.startsWith("trans_") ? (
          <TransparentMaterial />
        ) : (
          <Material />
        )}
      </mesh>

      {bodyColour.startsWith("trans_") && (
        <>
          <MainBoard />
          <Speakers />
          <Battery />
        </>
      )}

      <Buttons />
      <DPAD />
      <BottomButtons />
      <ShoulderButtons />

      <Screen screenMaterial={screenMaterial} />

      {/* Power Button */}
      <mesh
        position={[-8.3, 5.678, -0.07]}
        scale={[0.2, 0.2, 0.2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <PowerButtonPrimitive />
        <meshBasicMaterial attach="material" color="rgb(88, 144, 80)" />
      </mesh>
      {/* Volume Button */}

      <mesh
        position={[-8.35, 8.1, -0.07]}
        scale={[0.2, 0.2, 0.2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <VolumeButtonPrimitive />
        {buttonsColour.startsWith("trans_") ? (
          <TransparentMaterial isButton />
        ) : (
          <Material isButton />
        )}
      </mesh>
    </group>
  )
}

const Screen = ({ screenMaterial }: PocketProps) => {
  const bodyColour = useContext(BodyColourContext)
  const alphaMap = useLoader(TextureLoader, screenAlphaMap)

  return (
    <>
      {/* colour */}
      <mesh position={[0, 6.8, 1.41]}>
        <planeGeometry attach="geometry" args={[17.25, 15.95]} />
        <meshPhysicalMaterial
          ior={1.46}
          color={bodyColour === "white" ? "rgb(222,222,220)" : "black"}
          reflectivity={0.3}
          alphaMap={alphaMap}
          alphaTest={0.5}
        />
      </mesh>

      {/* LCD */}
      <mesh position={[0, 7, 1.42]}>
        <planeGeometry attach="geometry" args={[160 / 11.5, 140 / 11.5]} />
        {screenMaterial || (
          <meshPhongMaterial attach="material" color="green" />
        )}
      </mesh>
      {/* Glass */}
      <mesh position={[0, 6.8, 1.43]}>
        <planeGeometry attach="geometry" args={[17.25, 15.95]} />
        <meshPhysicalMaterial
          roughness={0}
          transmission={1}
          ior={1.51714}
          transparent
          alphaMap={alphaMap}
          alphaTest={0.5}
        />
      </mesh>
    </>
  )
}

const BUTTON_GAP = 1.25 as const

const Buttons = () => {
  const buttonsColour = useContext(ButtonsColourContext)

  const positions = [
    [BUTTON_GAP, 0, BUTTON_GAP],
    [-BUTTON_GAP, 0, BUTTON_GAP],
    [-BUTTON_GAP, 0, -BUTTON_GAP],
    [BUTTON_GAP, 0, -BUTTON_GAP],
  ] as const

  const refs = [
    useRef<Mesh>(null),
    useRef<Mesh>(null),
    useRef<Mesh>(null),
    useRef<Mesh>(null),
  ]
  const hoverButtonRef = useRef<keyof typeof refs | null>(null)

  useFrame(() => {
    refs.forEach((buttonRef, index) => {
      if (buttonRef.current) {
        if (hoverButtonRef.current === index) {
          buttonRef.current.position.y = MathUtils.lerp(
            buttonRef.current.position.y,
            -0.5,
            0.25
          )
        } else {
          buttonRef.current.position.y = MathUtils.lerp(
            buttonRef.current.position.y,
            0,
            0.25
          )
        }
      }
    })
  })

  return (
    <group
      position={[4.9, -5.2, 0.8]}
      rotation={[Math.PI / 2, Math.PI / 4, 0]}
      castShadow
      receiveShadow
    >
      {positions.map((p, index) => (
        <mesh
          ref={refs[index]}
          position={p}
          key={index}
          castShadow
          receiveShadow
          onPointerEnter={() => (hoverButtonRef.current = index)}
          onPointerLeave={() => (hoverButtonRef.current = null)}
          scale={[0.2, 0.2, 0.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* <cylinderGeometry attach="geometry" args={[0.9, 0.9, 1, 16]} /> */}
          {index > 1 ? <ConcavePrimitive /> : <ConvexPrimitive />}
          {buttonsColour.startsWith("trans_") ? (
            <TransparentMaterial isButton />
          ) : (
            <Material isButton />
          )}
        </mesh>
      ))}
    </group>
  )
}

const BottomButtons = () => {
  const positions = [
    [BUTTON_GAP, 0, BUTTON_GAP],
    [0, 0, 0],
    [-BUTTON_GAP, 0, -BUTTON_GAP],
  ] as const

  const buttonsColour = useContext(ButtonsColourContext)
  const refs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)]
  const hoverButtonRef = useRef<keyof typeof refs | null>(null)

  useFrame(() => {
    refs.forEach((buttonRef, index) => {
      if (buttonRef.current) {
        if (hoverButtonRef.current === index) {
          buttonRef.current.position.y = MathUtils.lerp(
            buttonRef.current.position.y,
            -0.25,
            0.25
          )
        } else {
          buttonRef.current.position.y = MathUtils.lerp(
            buttonRef.current.position.y,
            0,
            0.25
          )
        }
      }
    })
  })

  return (
    <group
      position={[0, -11.9, 0.6]}
      rotation={[Math.PI / 2, Math.PI / 4, 0]}
      castShadow
      receiveShadow
    >
      {positions.map((p, index) => (
        <mesh
          position={p}
          key={index}
          ref={refs[index]}
          onPointerEnter={() => (hoverButtonRef.current = index)}
          onPointerLeave={() => (hoverButtonRef.current = null)}
          castShadow
          receiveShadow
        >
          <cylinderGeometry attach="geometry" args={[0.5, 0.5, 1.5, 12]} />
          {buttonsColour.startsWith("trans_") ? (
            <TransparentMaterial isButton />
          ) : (
            <Material isButton />
          )}
        </mesh>
      ))}
    </group>
  )
}

const DPAD = () => {
  const buttonsColour = useContext(ButtonsColourContext)
  const hoverRef = useRef<boolean>(false)
  const angleRef = useRef<number>(0)
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    if (groupRef.current && hoverRef.current) {
      groupRef.current.rotation.z = MathUtils.lerp(
        groupRef.current.rotation.z,
        Math.cos(angleRef.current - Math.PI) / 5,
        0.25
      )
      groupRef.current.rotation.x = MathUtils.lerp(
        groupRef.current.rotation.x,
        Math.sin(angleRef.current) / 5,
        0.25
      )
    }
  })

  return (
    <group
      onPointerEnter={() => (hoverRef.current = true)}
      onPointerLeave={() => {
        hoverRef.current = false
        groupRef.current?.rotation.set(0, 0, 0)
      }}
      position={[-4.9, -5.2, 1]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <mesh
        position={[0, 0, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[6, 6, 6]}
        onPointerMove={(e) => {
          if (!e.uv) return
          const { x, y } = e.uv
          angleRef.current = Math.atan2(y - 0.5, x - 0.5)
        }}
      >
        <planeGeometry />
        <meshBasicMaterial opacity={0} transparent side={DoubleSide} />
      </mesh>

      <group ref={groupRef}>
        <mesh
          castShadow
          receiveShadow
          scale={[0.2, 0.2, 0.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <DpadPrimitive />
          {buttonsColour.startsWith("trans_") ? (
            <TransparentMaterial isButton />
          ) : (
            <Material isButton />
          )}
        </mesh>
      </group>
    </group>
  )
}

const ShoulderButtons = () => {
  const buttonsColour = useContext(ButtonsColourContext)
  const leftButtonRef = useRef<Mesh>(null)
  const leftButtonHoverRef = useRef(false)

  const rightButtonRef = useRef<Mesh>(null)
  const rightButtonHoverRef = useRef(false)

  const BUTTON_UP = 3.25
  const BUTTON_DOWN = 2.8

  useFrame(() => {
    if (leftButtonRef.current) {
      if (leftButtonHoverRef.current) {
        leftButtonRef.current.position.y = MathUtils.lerp(
          leftButtonRef.current.position.y,
          BUTTON_DOWN,
          0.25
        )
      } else {
        leftButtonRef.current.position.y = MathUtils.lerp(
          leftButtonRef.current.position.y,
          BUTTON_UP,
          0.25
        )
      }
    }

    if (rightButtonRef.current) {
      if (rightButtonHoverRef.current) {
        rightButtonRef.current.position.y = MathUtils.lerp(
          rightButtonRef.current.position.y,
          BUTTON_DOWN,
          0.25
        )
      } else {
        rightButtonRef.current.position.y = MathUtils.lerp(
          rightButtonRef.current.position.y,
          BUTTON_UP,
          0.25
        )
      }
    }
  })

  return (
    <>
      <mesh
        position={[-7.3, BUTTON_DOWN, -2.6]}
        ref={leftButtonRef}
        onPointerEnter={() => (leftButtonHoverRef.current = true)}
        onPointerLeave={() => (leftButtonHoverRef.current = false)}
        scale={[0.2, -0.2, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ShoulderButtonPrimitive />
        {buttonsColour.startsWith("trans_") ? (
          <TransparentMaterial isButton />
        ) : (
          <Material isButton />
        )}
      </mesh>
      <mesh
        position={[7.3, BUTTON_DOWN, -2.6]}
        ref={rightButtonRef}
        onPointerEnter={() => (rightButtonHoverRef.current = true)}
        onPointerLeave={() => (rightButtonHoverRef.current = false)}
        scale={[0.2, 0.2, 0.2]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
      >
        <ShoulderButtonPrimitive />
        {buttonsColour.startsWith("trans_") ? (
          <TransparentMaterial isButton />
        ) : (
          <Material isButton />
        )}
      </mesh>
    </>
  )
}

const Material = ({ isButton = false }: { isButton?: boolean }) => {
  const bodyColour = useContext(BodyColourContext)
  const buttonsColour = useContext(ButtonsColourContext)
  const colour = isButton ? buttonsColour : bodyColour

  const COLOUR: PartialColourMap = {
    black: "rgb(25,25,25)",
    white: "rgb(244,244,244)",
    glow: "rgb(163, 195, 138)",
  }

  return (
    <meshPhysicalMaterial
      attach="material"
      ior={isButton ? 1.4 : 1.74}
      color={COLOUR[colour] || "red"}
      clearcoat={isButton ? 0.75 : 0.1}
      clearcoatRoughness={isButton ? 0 : 1}
      emissive={COLOUR[colour] || "red"}
      emissiveIntensity={colour === "glow" ? 1.5 : 0}
      toneMapped={colour !== "glow"}
      envMapIntensity={0}
    />
  )
}

const Battery = () => {
  return (
    <mesh position={[0, -6.5, -2]}>
      <RoundedBox castShadow receiveShadow args={[14, 9, 2]} radius={0.5}>
        <meshBasicMaterial attach="material" color="rgb(0, 0, 0)" />
      </RoundedBox>
    </mesh>
  )
}

const Speakers = () => {
  return (
    <>
      <mesh position={[6.6, 11.5, 0]}>
        <RoundedBox castShadow receiveShadow args={[3.5, 5, 2]} radius={0.5}>
          <meshBasicMaterial attach="material" color="rgb(0, 0, 0)" />
        </RoundedBox>
      </mesh>
      <mesh position={[-6.6, 11.5, 0]}>
        <RoundedBox castShadow receiveShadow args={[3.5, 5, 2]} radius={0.5}>
          <meshBasicMaterial attach="material" color="rgb(0, 0, 0)" />
        </RoundedBox>
      </mesh>
    </>
  )
}

const MainBoard = () => {
  const board = useLoader(GLTFLoader, boardGLB)
  return (
    <group
      scale={[6, 6, 6]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, -0.1, -0.4]}
    >
      <primitive object={board.scene} />
    </group>
  )
}

const TransparentMaterial = ({ isButton = false }: { isButton?: boolean }) => {
  const bodyColour = useContext(BodyColourContext)
  const buttonsColour = useContext(ButtonsColourContext)

  const colour = isButton ? buttonsColour : bodyColour

  const COLOURS: PartialColourMap = {
    trans_purple: "rgb(205,175,250)",
    trans_orange: "rgb(200,130,10)",
    trans_clear: "rgb(220,220,220)",
    trans_smoke: "rgb(120,120,120)",
    trans_red: "rgb(235, 90, 90)",
    trans_blue: "rgb(110, 100, 255)",
    trans_green: "rgb(110, 255, 110)",
  }

  return (
    <meshPhysicalMaterial
      attach="material"
      transmission={0.975}
      opacity={1}
      roughness={0.2}
      color={COLOURS[colour] || "red"}
      ior={1.46}
      clearcoat={1}
      clearcoatRoughness={1}
      transparent
      side={DoubleSide}
    />
  )
}
