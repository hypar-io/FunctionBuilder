import * as THREE from 'three';
// Set the THREE global. Required for things like OrbitControls.
let w: any = window;
w.THREE = THREE;
require('./GLTFLoader.js');
require('./OrbitControls.js');

let renderer: THREE.WebGLRenderer;
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;
let gltfScene: THREE.Scene;
let controls: any;
let modelUri: string;

declare var acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

export function init(uri: string) {

	modelUri = uri;

	window.addEventListener('message', event => {
		const message = event.data;
		switch (message.command) {
			case 'load-model':
				loadModel();
				break;
			case 'update-inputs':
				updateInputs(message.data);
				break;
			case 'update-outputs':
				updateOutputs(message.data);
				break;
		}
	});

	let captureButton = <HTMLButtonElement>document.getElementById("capture");
	captureButton.addEventListener("click", ()=>{
		let strMime = "image/png";
		let imgData = renderer.domElement.toDataURL(strMime);
		vscode.postMessage({
			command: 'image-captured',
			data: imgData
		});
	});

	scene = new THREE.Scene();
	var div = <HTMLDivElement>document.getElementById("model");
	camera = new THREE.PerspectiveCamera(75, div.clientWidth / div.clientHeight, 0.1, 1000);

	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
	renderer.setSize(div.clientWidth, div.clientHeight);
	renderer.setClearColor(0x000000, 0);
	div.appendChild(renderer.domElement);
	
	// @ts-ignore
	controls = new THREE.OrbitControls(camera, renderer.domElement);

	var hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.75);
	scene.add(hemiLight);
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.75 );
	directionalLight.position.set(0.5,0.5,0.0);
	scene.add( directionalLight );

	// Rotate the axes helper to show Z up.
	var axesHelper = new THREE.AxesHelper(2);
	axesHelper.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
	scene.add(axesHelper);

	window.addEventListener('resize', onWindowResize, false);
	
	camera.position.z = 5;

	animate();

	loadModel();
}

export function loadModel() {
	console.debug("Loading model...");

	// Instantiate a loader
	// @ts-ignore
	var loader = new THREE.GLTFLoader();

	// Load a glTF resource
	loader.load(
		modelUri,
		function (gltf: any) {
			if(gltfScene){
				scene.remove(gltfScene);
				doDispose(gltfScene);
			}
			gltfScene = gltf.scene;
			scene.add(gltf.scene);
		},
		// called while loading is progressing
		function (xhr: any) {
			console.log((xhr.loaded / xhr.total * 100) + '% loaded');
		},
		// called when loading has errors
		function (error: any) {
			console.log('An error happened');
			console.warn(error);
		}
	);
}

function updateInputs(hypar: any): void {
	console.debug("Updating inputs.");
	var inputsContainer = <HTMLDivElement>document.getElementById("inputs");
	inputsContainer.innerHTML = '';
	for(let i=0; i<hypar.inputs.length; i++)
	{
		let input = hypar.inputs[i];
		if(input.type == 'range')
		{
			let inputTitleDiv = document.createElement("p");
			inputTitleDiv.innerHTML = input.name;
			inputsContainer.appendChild(inputTitleDiv);

			let inputDiv = document.createElement("input");
			inputDiv.type = "range";
			inputDiv.id = input.name;
			inputDiv.min = input.min;
			inputDiv.max = input.max;
			inputDiv.step = input.step;
			inputDiv.value = input.min;
			inputsContainer.appendChild(inputDiv);

			inputDiv.addEventListener("input", ()=>{
				vscode.postMessage({
					command: 'input-value-changed',
					name: inputDiv.id,
					value: inputDiv.value
				});
			});
		}
	}
	
}

function updateOutputs(outputs: any) {
	let outputsDiv = <HTMLDivElement>document.getElementById("outputs");
	outputsDiv.innerHTML = '';
	for(var prop in outputs) {
		let title = document.createElement("p");
		title.textContent = prop;
		let value = document.createElement("h3");
		if(typeof outputs[prop] == "number") {
			value.textContent = outputs[prop].toFixed(3);
		} else {
			value.textContent = outputs[prop];
		}
		
		outputsDiv.appendChild(title);
		outputsDiv.appendChild(value);
	}
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

function onWindowResize() {
	var div = <HTMLDivElement>document.getElementById("model");
	camera.aspect = div.clientWidth / div.clientHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(div.clientWidth, div.clientHeight);
}

function doDispose (obj: any)
{
	if (obj !== null)
	{
		for (var i = 0; i < obj.children.length; i++)
		{
			doDispose(obj.children[i]);
		}
		if (obj.geometry)
		{
			obj.geometry.dispose();
			obj.geometry = undefined;
		}
		if (obj.material)
		{
			if (obj.material.map)
			{
				obj.material.map.dispose();
				obj.material.map = undefined;
			}
			obj.material.dispose();
			obj.material = undefined;
		}
	}
	obj = undefined;
}