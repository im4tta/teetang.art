/** GLB export: the plate as a coloured 3D model for other 3D tools. */
import { Scene, type Mesh, type MeshStandardMaterial } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { PhotoInput } from "./photo";

/** The plate as a binary glTF, 10 cm wide, for Blender, Sketchfab or AR viewers. */
export async function buildGlb(input: PhotoInput): Promise<Blob> {
  // glTF is in metres: a plate 1 unit wide becomes 10 cm, its base on the ground.
  input.group.scale.setScalar(0.1);
  input.group.position.y = input.baseDepth * 0.1;
  const scene = new Scene();
  scene.add(input.group);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true });
  input.group.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const material = mesh.material as MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
  });
  return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
}
