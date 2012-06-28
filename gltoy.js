// Except as noted,
// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.
//
// Exception: The code of prepareShader and prepareProgram is derived from
// the Learning WebGL lessons, at http://learningwebgl.com/blog/?p=1786 (as of
// September 2011). No license is stated on that site, but I (Kevin Reid)
// believe that it is obviously the authors' intent to make this code free to
// use.

/*
GL/shader state management policies
-----------------------------------
TODO write this up
*/

var gltoy = {};

(function () {
  "use strict";
  
  // --- Constants and utilities ---
  
  var DEBUG_GL = false;
  
  function getWebGLContext(canvas, options) {
    return canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
  }
  
  function prepareShader(gl, type, sources, declarations) {
    // See note in license statement at the top of this file.
    
    var strings = [];
    for (var prop in declarations) {
      var value = declarations[prop];
      if (typeof value == "boolean") {
        value = value ? 1 : 0; // GLSL preprocessor doesn't do booleans
      }
      strings.push("#define ", prop, " (", value, ")\n");
    }
    sources.forEach(function (text, index) {
      strings.push("#line 1 ", index.toString(), "\n", text);
    });
    
    var shader = gl.createShader(type);
    
    gl.shaderSource(shader, strings.join(""));
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      if (typeof console !== "undefined") console.log("Shader text:\n" + strings.join(""));
      throw new Error(gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }
  
  function prepareProgram(gl, declarations, boundAttribLocations, vertexSources, fragmentSources) {
    // See note in license statement at the top of this file.
    
    var vertexShader = prepareShader(gl, gl.VERTEX_SHADER, vertexSources, declarations);
    var fragmentShader = prepareShader(gl, gl.FRAGMENT_SHADER, fragmentSources, declarations);
    
    var program = gl.createProgram();
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    for (var attribName in boundAttribLocations) {
      var index = boundAttribLocations[attribName];
      if (typeof index === "number") {
        gl.bindAttribLocation(program, index, attribName);
      } else {
        if (typeof console !== "undefined") {
          console.warn("Enumerable non-number", attribName, "in boundAttribLocations object", boundAttribLocations);
        }
      }
    }
    
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    
    var i, name;
    var attribs = Object.create(boundAttribLocations);
    for (i = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) - 1; i >= 0; i--) {
      name = gl.getActiveAttrib(program, i).name;
      attribs[name] = gl.getAttribLocation(program, name);
    }
    var uniforms = {};
    for (i = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
      name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    
    return {
      program: program,
      attribs: attribs,
      uniforms: uniforms,
      deleteResources: function () {
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
      }
    };
  }
  
  // 'type' is an xhr.responseType value such as 'text' or 'arraybuffer'
  // The callback will be called with parameters (response), or (null,
  // opt exception) in the event of a failure.
  function fetchResource(url, type, callback) {
    // TODO: review this code
    //if (typeof console !== "undefined")
    //  console.log("Fetching", url);
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = type;
    xhr.onreadystatechange = function () {
      if (xhr.readyState != XMLHttpRequest.DONE) {
        return;
      }
      //if (typeof console !== "undefined")
      //  console.log("completed", url, xhr.status);
      if (xhr.status == 200) {
        callback(xhr.response, null);
      } else {
        if (typeof console !== "undefined")
          console.error("XHR reported failure:", xhr.readyState, xhr.status);
        callback(null, null);
      }
    };
    try {
      xhr.send(null);
    } catch (e) {
      if (typeof console !== "undefined")
        console.error("XHR send crashed:", e);
      setTimeout(function () {
        callback(null, e);
      }, 0);
    }
  }
  
  // --- Main definition ---
  
  function GLWrapper(canvas) {
    var glw = this;
    var gl = null;
    
    // View and projection transformation globals.
    var pagePixelWidth, pagePixelHeight;
    var pMatrix = mat4.create();
    var modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    var viewMatrix = mat4.create();
    mat4.identity(viewMatrix);
    var mvMatrix = mat4.create();
    mat4.identity(mvMatrix);
    
    var contextLost = false;
    
    // Shader programs, and attrib and uniform locations
    var programSetup = null;
    var attribs, uniforms;
    
    // --- Internals ---
    
    function buildProgram() {
      attribs = {};
      uniforms = {};
    }
    
    function initContext() {
      buildProgram();
      sendViewUniforms();
    }
    
    function updateViewport() {
      var computedStyle = window.getComputedStyle(canvas,null);
      pagePixelWidth = parseInt(computedStyle.width, 10);
      pagePixelHeight = parseInt(computedStyle.height, 10);
      
      // Specify canvas resolution
      canvas.width = pagePixelWidth;
      canvas.height = pagePixelHeight;
      
      // WebGL is not guaranteed to give us that resolution; instead, what it
      // can supply is returned in .drawingBuffer{Width,Height}. However, those
      // properties are not supported by, at least, Firefox 6.0.2.
      if (typeof gl.drawingBufferWidth !== "number") {
        gl.drawingBufferWidth = pagePixelWidth;
        gl.drawingBufferHeight = pagePixelHeight;
      }
      
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      updateProjection();
    }
    
    function updateProjection() {
      var fov = 60; // TODO config.fov.get();
      var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      
      var nearestApproachToCamera = 1.0;
      var nearPlane = nearestApproachToCamera 
                      / Math.sqrt(1 + Math.pow(Math.tan(fov/180*Math.PI/2), 2)
                                      * (Math.pow(aspectRatio, 2) + 1));
      var farPlane = 500; // TODO
      
      mat4.perspective(fov,
                       aspectRatio,
                       nearPlane,
                       farPlane,
                       pMatrix);

      sendViewUniforms();
    }
    
    function sendViewUniforms() {
      gl.uniformMatrix4fv(uniforms.uPMatrix, false, pMatrix);
      gl.uniformMatrix4fv(uniforms.uMVMatrix, false, mvMatrix);
    }
    
    function doModelview() {
      mat4.multiply(viewMatrix, modelMatrix, mvMatrix);
      gl.uniformMatrix4fv(uniforms.uMVMatrix, false, mvMatrix);
    }

    function handleContextLost(event) {
      contextLost = true;
    }
    
    function handleContextRestored() {
      // TODO call back to reinit everything
      contextLost = false;
      initContext();
      scheduleDraw();
    }
    
    // --- Initialization ---
    
    gl = getWebGLContext(canvas, {});
    if (DEBUG_GL) {
      gl = WebGLDebugUtils.makeDebugContext(gl);
    } else {
      WebGLDebugUtils.init(gl);
    }
    this.context = gl;
    
    if (!gl) throw new Renderer.NoWebGLError();
    
    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false);
    
    initContext();
    updateViewport();
    
    window.addEventListener("resize", function () { // TODO shouldn't be global
      updateViewport();
      return true;
    }, false);
    
    // --- Public components ---
    
    function compile(programDesc, resources) {
      var programW = prepareProgram(gl, {}, {},
        programDesc.vertex.map(function (name) { return resources[name]; }),
        programDesc.fragment.map(function (name) { return resources[name]; }));
      return programW;
    }
    this.compile = compile;
    
    function useProgramW(newP) {
      gl.useProgram(newP.program);
      attribs = newP.attribs;
      uniforms = newP.uniforms;
      
      sendViewUniforms();
    }
    this.useProgramW = useProgramW;
    
    function setTransitionOut(mix) {
      mat4.identity(viewMatrix);
      mat4.translate(viewMatrix, [0, mix * 6, 0]);
      doModelview();
    }
    this.setTransitionOut = setTransitionOut;
    
    function setTransitionIn(mix) {
      mat4.identity(viewMatrix);
      mat4.translate(viewMatrix, [0, mix * 6 - 6, 0]);
      doModelview();
    }
    this.setTransitionIn = setTransitionIn;
    
    function setModelMatrix(matrix) {
      mat4.set(matrix, modelMatrix);
      doModelview();
    }
    this.setModelMatrix = setModelMatrix;
    
    function beginFrame() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      //mat4.identity(pMatrix);
      //mat4.ortho(-1.5, 1.5, -1.5, 1.5, 0.01, 100.0, pMatrix); // TODO
      //gl.uniformMatrix4fv(uniforms.uPMatrix, false, pMatrix);
    }
    this.beginFrame = beginFrame;

    function endFrame() {
      
    }
    this.endFrame = endFrame;
    
    function BufferAndArray(layout) {
      this.layout = layout;
      this.buffer = gl.createBuffer();
      this.array = null;

      this._elementsPerVertex = 0;
      this.layout.forEach(function (layoutItem) {
        this._elementsPerVertex += layoutItem.components;
      }.bind(this));
    }
    BufferAndArray.prototype.countVertices = function () {
      return this.array.length / this.layout.TODOimplementthis;
    };
    BufferAndArray.prototype.load = function (jsArray) {
      this.array = new Float32Array(jsArray);
    };
    BufferAndArray.prototype.send = function (mode) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.array, mode);
    };
    BufferAndArray.prototype.attrib = function () {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      var BPE = this.array.BYTES_PER_ELEMENT;
      var stride = this._elementsPerVertex * BPE;
      var offset = 0;
      this.layout.forEach(function (layoutItem) {
        gl.enableVertexAttribArray(layoutItem.attrib);
        gl.vertexAttribPointer(
          layoutItem.attrib,
          layoutItem.components,
          gl.FLOAT,
          false,
          stride,
          offset);
        offset += layoutItem.components * BPE;
      });
    };
    BufferAndArray.prototype.draw = function (mode) {
      gl.drawArrays(mode, 0, this.array.length / this._elementsPerVertex);
    };
    BufferAndArray.prototype.unattrib = function () {
      this.layout.forEach(function (layoutItem) {
        gl.disableVertexAttribArray(layoutItem.attrib);
      });
    };
    BufferAndArray.prototype.deleteResources = function () {
      gl.deleteBuffer(this.buffer);
      this.buffer = this.array = null;
    };
    this.BufferAndArray = BufferAndArray;
    
    Object.defineProperties(this, {
      attribs: {
        enumerable: true,
        get: function () { return attribs; }
      },
      uniforms: {
        enumerable: true,
        get: function () { return uniforms; }
      },
    });
    
    Object.seal(this); // TODO freeze all but verticesDrawn
  }
  
  GLWrapper.NoWebGLError = function () {
    Error.call(this);
  };
  GLWrapper.NoWebGLError.prototype = Object.create(Error.prototype);
  
  gltoy.fetchShaders = function (directory, desc, callback) {
    var table = Object.create(null);
    function put(name) {
      table[name] = undefined;
    }
    desc.vertex.forEach(put);
    desc.fragment.forEach(put);

    var done = false;
    var names = Object.keys(table);
    names.forEach(function (filename) {
      // TODO perform relative url resolution
      fetchResource(directory+filename, "text", function (data) { 
        table[filename] = data;
        check();
      });
    });
    
    function check() {
      if (names.every(function (f) { return table[f] !== undefined; })) {
        if (done) return; // in case of multiple failures
        done = true;
        if (names.some(function (f) { return table[f] === null; })) {
          callback(null); // TODO better error reporting
        } else {
          callback(Object.freeze(table));
        }
      }
    }
  };
  
  gltoy.GLWrapper = Object.freeze(GLWrapper);
}());
