let renderer = null
let controls = null
let camera = null
let scene = null
let gltfScene = null
let modelUri = null
let vscode = null

function init(uri) {

	modelUri = uri

	window.addEventListener('message', event => {
		const message = event.data;
		switch (message.command) {
			case 'load-model':
				loadModel();
				break;
			case 'update-data-display':
				updateDataDisplay(message.data);
				break;
		}
	});

	vscode = acquireVsCodeApi();
	var inputsDiv = document.getElementById("inputs")
	var inputs = inputsDiv.getElementsByTagName("input")
	for(let i=0; i<inputs.length; i++)
	{
		console.debug(inputs[i].id)
		inputs[i].addEventListener("input", ()=>{
			vscode.postMessage({
				command: 'input-value-changed',
				name: inputs[i].id,
				value: inputs[i].value
			})
		});
	}

	let captureButton = document.getElementById("capture")
	captureButton.addEventListener("click", ()=>{
		let strMime = "image/png";
		let imgData = renderer.domElement.toDataURL(strMime);
		vscode.postMessage({
			command: 'image-captured',
			data: imgData
		})
	})

	scene = new THREE.Scene();
	var div = document.getElementById("model")
	camera = new THREE.PerspectiveCamera(75, div.clientWidth / div.clientHeight, 0.1, 1000);

	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
	renderer.setSize(div.clientWidth, div.clientHeight);
	renderer.setClearColor(0x000000, 0);
	div.appendChild(renderer.domElement);

	controls = new THREE.OrbitControls(camera, renderer.domElement);

	var hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.75);
	scene.add(hemiLight);
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.75 );
	directionalLight.position.set(0.5,0.5,0.0)
	scene.add( directionalLight );

	// Rotate the axes helper to show Z up.
	var axesHelper = new THREE.AxesHelper(2);
	axesHelper.rotateOnAxis(new THREE.Vector3(1,0,0), -Math.PI/2);
	scene.add(axesHelper);

	window.addEventListener('resize', onWindowResize, false);

	camera.position.z = 5;

	animate();

	loadModel()
}

function updateDataDisplay(data) {
	let outputEl = document.getElementById("outputs");
	outputEl.innerHTML = '';
	for(var prop in data) {
		let title = document.createElement("p");
		title.textContent = prop;
		let value = document.createElement("h1");
		if(typeof data[prop] == "number") {
			value.textContent = data[prop].toFixed(3);
		} else {
			value.textContent = data[prop]
		}
		
		outputEl.appendChild(title)
		outputEl.appendChild(value)
	}
}

var animate = function () {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
};

function onWindowResize() {
	var div = document.getElementById("model");
	camera.aspect = div.clientWidth / div.clientHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(div.clientWidth, div.clientHeight);
};

const fitCameraToObject = function (object, offset, orbitControls) {

	const boundingBox = new THREE.Box3();
	boundingBox.setFromObject(object);

	const center = boundingBox.getCenter();
	const size = boundingBox.getSize();

	// get the max side of the bounding box
	const maxDim = Math.max(size.x, size.y, size.z) * 3;
	const fov = camera.fov * (Math.PI / 180);
	let cameraZ = Math.abs(maxDim / 4 * Math.tan(fov * 2));

	// offset the camera as desired - usually a value of ~ 1.25 is good to prevent
	// object filling the whole canvas
	if (offset !== undefined && offset !== 0) cameraZ *= offset;

	camera.position.set(center.x, center.y, cameraZ);

	// set the far plane of the camera so that it easily encompasses the whole object
	const minZ = boundingBox.min.z;
	const cameraToFarEdge = (minZ < 0) ? -minZ + cameraZ : cameraZ - minZ;

	camera.far = cameraToFarEdge * 3;
	camera.updateProjectionMatrix();

	if (orbitControls !== undefined) {

		// set camera to rotate around center of loaded object
		orbitControls.target = center;

		// prevent camera from zooming out far enough to create far plane cutoff
		orbitControls.maxDistance = cameraToFarEdge * 2;
	}
};

function loadModel(fitToCamera = false) {
	console.debug("Loading model...")
	// Instantiate a loader
	var loader = new THREE.GLTFLoader();

	// Load a glTF resource
	loader.load(
		modelUri,
		function (gltf) {
			if(gltfScene){
				scene.remove(gltfScene);
				doDispose(gltfScene);
			}
			gltfScene = gltf.scene;
			scene.add(gltf.scene);
			if(fitToCamera) {
				fitCameraToObject(gltf.scene, null, controls);
			}
		},
		// called while loading is progressing
		function (xhr) {
			console.log((xhr.loaded / xhr.total * 100) + '% loaded');
		},
		// called when loading has errors
		function (error) {
			console.log('An error happened');
			console.warn(error)
		}
	);
}

function doDispose (obj)
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
};

export{init, loadModel}