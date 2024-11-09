<template>
  <div ref="container" class="fixed w-screen h-screen top-0 left-0">
  </div>
  <div class="absolute left-2 top-2 max-w-[480px] p-2 bg-white rounded">
    <select v-model="selectedFile" @change="loadIfc" id="countries"
      class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5">
      <option v-for="(file, index) in ifcFiles" :selected="index === 0" :value="file">{{ file }}</option>
    </select>
  </div>
  <button @click="toggleEditMode"
    class="absolute bottom-[25px] right-1/2 md:right-[25px] transform translate-x-1/2 md:translate-x-0 bg-orange-custom text-white font-semibold px-4 py-2 rounded-xl border border-white ">
    {{ editMode ? 'Toggle placement off' : 'Place Marker' }}
  </button>
  <button v-if="editMode" @click="savePosition"
    class="bg-white absolute bottom-[85px] md:bottom-[25px] right-1/2 md:right-[225px] transform translate-x-1/2 md:translate-x-0 font-semibold px-4 py-2 rounded-xl border border-orange-custom text-orange-custom">
    Save Position
  </button>
</template>

<script setup>
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { onMounted, onBeforeUnmount, ref, watch } from "vue";

let ifcFiles = [
  'https://maciejaroslaw.github.io/Kaapelitehdas_junction.ifc',
  'https://maciejaroslaw.github.io/YhdistettyTATE_ARK_1.ifc',
]

let selectedFile = ref('')

const editMode = ref(false);
function toggleEditMode() {
  editMode.value = !editMode.value;
}

const container = ref(null); // Reference for the container div
let components = null;
let world = null;
let raycaster = new THREE.Raycaster(); // For detecting click positions
let mouse = new THREE.Vector2(); // For storing mouse coordinates
let sphere = null;
let labelSprite = null;
let currentModel = null;


function createTextSprite(message, fontSize = 24, color = "#ff0000") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  context.font = `${fontSize}px Arial`;
  context.fillStyle = color;

  // Set canvas dimensions based on the text size
  const textWidth = context.measureText(message).width;
  canvas.width = textWidth + 20;
  canvas.height = fontSize + 20;

  // Re-set font and fill style after resizing
  context.font = `${fontSize}px Arial`;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);

  return sprite;
}

// Function to add a custom polygon at a given 3D position
function addCustomPolygon(position, normal) {
  const radius = 0.5;  // You can adjust the radius as needed

  // Create a sphere geometry
  const geometry = new THREE.SphereGeometry(radius, 32, 32); // 32 segments for a smoother sphere

  // Create a material for the sphere
  const material = new THREE.MeshBasicMaterial({
    color: 0x0000ff,  // Red color for the sphere
    transparent: true,
    opacity: 0.6,  // Transparency
  });

  // Create the sphere mesh
  const sphereMesh = new THREE.Mesh(geometry, material);

  // Position the sphere at the correct location
  sphereMesh.position.copy(position);

  // Optionally align the sphere to the wall (if you want it to stick to the surface in a specific orientation)
  alignCuboidToWall(sphereMesh, normal);  // You can use the same alignment function for consistency

  sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  // Add the sphere to the scene
  world.scene.three.add(sphere);

  const label = createTextLabel("CUSTOOM TEXT");
  label.position.set(position.x, position.y + radius + 0.5, position.z); // Position label above the sphere
  world.scene.three.add(label);

  console.log("Sphere created:", sphere);
}

function getClosestFragment(intersectPoint) {
  const fragments = components.get(OBC.FragmentsManager);

  let closestFragment = null;
  let closestDistance = Infinity;
  let fragmentNormal = null;

  console.log("FRAGMENTS");
  console.log(fragments);

  // Check if fragments are available and ensure they're processed as expected
  if (fragments.list) {
    fragments.list.forEach((fragment) => {
      // Assuming fragment has a transformation matrix that we can use to calculate position
      const fragmentPosition = new THREE.Vector3();

      // We will attempt to extract the world position using the fragment's local matrix.
      // Since the fragment is an IFC model entity, we will use the matrix information to derive its position
      if (fragment.mesh.geometry) {
        // Extract the matrixWorld (transformation matrix) from the fragment's geometry
        fragment.mesh.geometry.computeBoundingBox();
        const center = fragment.mesh.geometry.boundingBox.getCenter(new THREE.Vector3());

        // Assuming the center of the bounding box corresponds to the fragment's position in local space
        fragmentPosition.copy(center); // Use center of bounding box as fragment position
      }

      // Calculate distance between fragment and clicked point
      const distance = fragmentPosition.distanceTo(intersectPoint);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFragment = fragment;

        // Get the normal vector of the closest fragment (assuming it’s a simple geometry like a plane or a wall)
        fragmentNormal = getFragmentNormal(fragment);
      }
    });
  }

  // console.log(closestFragment, fragmentNormal)
  return { closestFragment, fragmentNormal };
}

function getFragmentNormal(fragment) {
  const geometry = fragment.mesh.geometry;
  const normal = new THREE.Vector3();

  // Check if the geometry has faces and compute normal based on the first face
  if (geometry.isBufferGeometry) {
    geometry.computeVertexNormals(); // Compute normals if none exist

    // If vertex normals are still not available, we can calculate a face normal
    const position = geometry.attributes.position;
    const i1 = 0; // Index for first vertex
    const i2 = 1; // Index for second vertex
    const i3 = 2; // Index for third vertex

    const v1 = new THREE.Vector3(position.array[i1 * 3], position.array[i1 * 3 + 1], position.array[i1 * 3 + 2]);
    const v2 = new THREE.Vector3(position.array[i2 * 3], position.array[i2 * 3 + 1], position.array[i2 * 3 + 2]);
    const v3 = new THREE.Vector3(position.array[i3 * 3], position.array[i3 * 3 + 1], position.array[i3 * 3 + 2]);

    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    normal.crossVectors(edge1, edge2).normalize(); // Cross product to get face normal

    normal.transformDirection(fragment.mesh.matrixWorld); // Convert to world space
  }

  return normal;
}

function alignCuboidToWall(cuboidMesh, normal) {
  // We want the cuboid to have one of its sides aligned with the wall (parallel)
  const up = new THREE.Vector3(0, 1, 0); // Default up vector for cuboid

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(up, normal); // Align the cuboid to the normal of the wall

  cuboidMesh.rotation.setFromQuaternion(quaternion); // Apply the rotation to the cuboid

  // If the fragment's normal vector is vertical (like a wall), we might need to adjust
  // the dimensions of the cuboid. For example, rotating the cuboid to match the wall:
  // Swap width and height to make the cuboid "hang" from the wall
  if (Math.abs(normal.y) > 0.9) { // If the wall is vertical (normal roughly pointing up/down)
    const tempWidth = cuboidMesh.scale.x;
    cuboidMesh.scale.x = cuboidMesh.scale.y;
    cuboidMesh.scale.y = tempWidth;
  }
}

// Function to handle mouse click and add a polygon at the clicked location
function onDocumentMouseClick(event) {
  if (editMode.value) {
    event.preventDefault();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, world.camera.three);

    const intersects = raycaster.intersectObjects(world.scene.three.children, true);
    console.log(intersects);
    if (intersects.length > 0) {
      const intersectPoint = intersects[0].point;

      // Find the closest fragment to the clicked point
      const { closestFragment, fragmentNormal } = getClosestFragment(intersectPoint);
      if (sphere) {
        // If the sphere exists, move it to the clicked position
        sphere.position.copy(intersectPoint);
        console.log("Sphere moved to:", intersectPoint);
      } else {
        // If the sphere does not exist, create it at the clicked position
        addCustomPolygon(intersectPoint, fragmentNormal);
        // addSphere(intersectPoint);
      }
    }
  }
}

async function loadIfc() {
  // Clear the current model before loading a new one
  if (currentModel) {
    world.scene.three.remove(currentModel); // Remove the existing model
    currentModel.geometry?.dispose();       // Clean up geometry resources
    currentModel.material?.dispose();       // Clean up material resources
    currentModel = null;
  }

  if (selectedFile.value.length > 0) {
    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);

    const file = await fetch(selectedFile.value); // Use the selected file
    const data = await file.arrayBuffer();
    const buffer = new Uint8Array(data);
    currentModel = await fragmentIfcLoader.load(buffer); // Load the new model
    currentModel.name = "example";
    world.scene.three.add(currentModel); // Add new model to the scene
  }
}

watch(selectedFile, async () => {
  await loadIfc();
});

function savePosition() {
  console.log("SAVE");
}

// Initialize the OBC world when the component is mounted
onMounted(async () => {
  if (!container.value) return;

  // Create components
  components = new OBC.Components();

  // Access the worlds and create a new world with SimpleScene, SimpleCamera, and SimpleRenderer
  const worlds = components.get(OBC.Worlds);
  world = worlds.create();

  // Set up the scene, renderer, and camera
  if (world) {
    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, container.value);
    world.camera = new OBC.SimpleCamera(components);

    // Initialize components
    components.init();

    // Set camera controls
    world.camera.controls.setLookAt(12, 26, 34, 0, 0, -10);

    // Set up the scene
    world.scene.setup();

    // Set up grids
    const grids = components.get(OBC.Grids);
    grids.create(world);

    const fragments = components.get(OBC.FragmentsManager);
    const fragmentIfcLoader = components.get(OBC.IfcLoader);

    await fragmentIfcLoader.setup();
    fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;

    await loadIfc();

    const cameraPosition = world.camera.three.position;
    const zoomFactor = 5; // Adjust this factor for the zoom-out level

    // Move the camera back along its viewing direction
    cameraPosition.z += zoomFactor;

    // Update the camera position
    world.camera.three.position.copy(cameraPosition);
    world.camera.three.updateProjectionMatrix();

    container.value.addEventListener("click", onDocumentMouseClick);
  }
});

// Clean up when the component is unmounted
onBeforeUnmount(() => {
  if (world) {
    world.scene.dispose && world.scene.dispose(); // Dispose of scene if dispose method is available
    world.renderer.dispose && world.renderer.dispose(); // Dispose of renderer
    world.camera.dispose && world.camera.dispose(); // Dispose of camera
  }
  components = null;
  world = null;
});
</script>

<style scoped>
.btn-toggle-edit {
  position: absolute;
  bottom: 25px;
  right: 25px;
}

.btn-save {
  position: absolute;
  bottom: 25px;
  right: 250px;
  background-color: green;
}
</style>
