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

var gltoy, glw;

(function () {
  "use strict";
  
  var abs = Math.abs;
  var ceil = Math.ceil;
  var floor = Math.floor;
  var max = Math.max;
  var min = Math.min;
  var PI = Math.PI;
  var pow = Math.pow;
  var random = Math.random;
  var sqrt = Math.sqrt;
  var tan = Math.tan;
  
  // --- Constants and utilities ---
  
  var DEBUG_GL = false;
  
  var TWOPI = 2*PI;
  
  function noop () {}
  
  // TODO stub
  function def(obj) {
    return Object.freeze(obj);
  }
  
  function interp(a, b, mix) {
    return a * (1-mix) + b * mix;
  }
  
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
      } else if (typeof value === "undefined") {
        continue;
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
      name = name.replace(/\[0\]$/, "");
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
  
  // --- GLWrapper ---
  
  function GLWrapper(canvas, view) {
    var glw = this;
    var gl = null;
    
    // View and projection transformation globals.
    var pagePixelWidth, pagePixelHeight;
    var aspectRadiusX, aspectRadiusY;
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
    var attribs = {};
    var uniforms = {};
    
    // --- Internals ---
    
    function initContext() {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
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
      
      // Adjust aspect ratio info
      aspectRadiusX = max(1.0, gl.drawingBufferWidth / gl.drawingBufferHeight);
      aspectRadiusY = max(1.0, gl.drawingBufferHeight / gl.drawingBufferWidth);
      
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
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
      // TODO call back to reinit everything (rebuild the effect)
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
    
    function compile(programDesc, resources, declarations) {
      var programW = prepareProgram(gl, declarations || {}, {},
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
    
    function setTransition(projection, transition, mix) {
      var distance = projection[1];
      
      var pargs = projection.slice(2);
      pargs.push(pMatrix);
      mat4[projection[0]].apply(undefined, pargs);
      
      mat4.identity(viewMatrix);
      mat4.translate(viewMatrix, [0, 0, -distance]);
      transition(viewMatrix, mix);
      
      doModelview();
      sendViewUniforms(); // TODO slightly redundant
    }
    this.setTransition = setTransition;
    
    function setModelMatrix(matrix) {
      mat4.set(matrix, modelMatrix);
      doModelview();
    }
    this.setModelMatrix = setModelMatrix;
    
    function beginFrame() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
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
      aspectRadiusX: {
        enumerable: true,
        get: function () { return aspectRadiusX; }
      },
      aspectRadiusY: {
        enumerable: true,
        get: function () { return aspectRadiusY; }
      },
    });
    
    Object.seal(this); // TODO freeze all but verticesDrawn
  }
  
  GLWrapper.NoWebGLError = function () {
    Error.call(this);
  };
  GLWrapper.NoWebGLError.prototype = Object.create(Error.prototype);
  
  function fetchShaders(directory, desc, callback) {
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
  }
  
  // --- Tumbler ---
  
  function Tumbler(parameters) {
    var f;
    switch (parameters.type) {
      case "rots1":
        f = function (matrix, rtime) {
          var time = rtime / 360 * TWOPI;
          mat4.rotateX(matrix, time * 3);
          mat4.rotateY(matrix, time * 4);
          mat4.rotateZ(matrix, time * 5);
          mat4.rotateX(matrix, time * 10);
          mat4.rotateY(matrix, time * 17);
          mat4.rotateZ(matrix, time * 19);
        };
        break;
      case "rots2":
        f = function (matrix, rtime) {
          var time = rtime / 360 * TWOPI;
          mat4.rotateX(matrix, time * 1.0);
          mat4.rotateY(matrix, time * 1.7);
          mat4.rotateZ(matrix, time * 1.9);
        };
        break;
      case "rots3":
        f = function (matrix, rtime) {
          var time = rtime / 360 * TWOPI;
          mat4.rotateX(matrix, time * 10);
          mat4.rotateY(matrix, time * 17);
          mat4.rotateZ(matrix, time * 19);
        };
        break;
      case "rots4":
        f = function (matrix, rtime) {
          var time = rtime / 360 * TWOPI;
          mat4.rotateY(matrix, time * 30);
          mat4.rotateX(matrix, time * 10);
          mat4.rotateY(matrix, time * 17);
          mat4.rotateZ(matrix, time * 19);
        };
        break;
      case "rotY'":
        f = function (matrix, rtime) {
          var time = rtime / 360 * TWOPI;
          mat4.rotateY(matrix, time * 10);
          mat4.rotateX(matrix, -0.194 * TWOPI);
        };
        break;
      case "rotX":
        f = function (matrix, time) {
          mat4.rotateX(matrix, time * 0.174);
        };
        break;
      case "rotY":
        f = function (matrix, time) {
          mat4.rotateY(matrix, time * 0.174);
        };
        break;
      case "rotZ":
        f = function (matrix, time) {
          mat4.rotateZ(matrix, time * 0.174);
        };
        break;
      // TODO add the "axis" and "params" modes from GLToy
      case "none": default:
        f = noop;
        break;
    }
    this.apply = f;
  }
  var tumbleModes = ["none", "rots1", "rots2", "rots3", "rots4", "rotY'", "rotX", "rotY", "rotZ"];
  Tumbler.configure = function () {
    var parameters = {
      type: randElem(tumbleModes)
    };
    // switch (type) {...}
    return parameters;
  };
  
  // --- Transitions ---
  
  function BaseTransition(inner) {
    var angle = random() * TWOPI;
    this.out = function (matrix, mix) {
      mat4.rotate(matrix,  angle, [0, 0, 1]);
      inner.out(matrix, mix);
      mat4.rotate(matrix, -angle, [0, 0, 1]);
    };
    this.in = function (matrix, mix) {
      mat4.rotate(matrix,  angle, [0, 0, 1]);
      inner.in(matrix, mix);
      mat4.rotate(matrix, -angle, [0, 0, 1]);
    };
  }
  function symmetricTransitionOut(matrix, mix) {
    return this.in(matrix, 1-mix);
  }
  
  function SlideTransition() {
    return new BaseTransition({
      out: function (matrix, mix) {
        mat4.translate(matrix, [0, (pow(mix, 2)) * 12, 0]);
      },
      in: function (matrix, mix) {
        mat4.translate(matrix, [0, (pow(1-mix, 2)) * -12, 0]);
      }
    });
  }
  
  function ScaleInTransition() {
    return new BaseTransition({
      out: symmetricTransitionOut,
      in: function (matrix, mix) {
        mix = pow(mix, 2);
        mat4.scale(matrix, [mix, mix, mix]);
      }
    });
  }
  
  function ScaleOutTransition() {
    return new BaseTransition({
      out: symmetricTransitionOut,
      in: function (matrix, mix) {
        mix = pow(mix, -4);
        mat4.scale(matrix, [mix, mix, mix]);
      }
    });
  }
  
  function SquishShiftTransition() {
    return new BaseTransition({
      out: function (matrix, mix) {
        mat4.translate(matrix, [mix, 0, 0]);
        mat4.scale(matrix, [1 - mix, 1 - mix, 1 - mix]);
      },
      in: function (matrix, mix) {
        mat4.translate(matrix, [(-1 + mix), 0, 0]);
        mat4.scale(matrix, [mix, mix, mix]);
      }
    });
  }
  
  function SquishCrossTransition() {
    return new BaseTransition({
      out: function (matrix, mix) {
        mat4.scale(matrix, [1 - mix, 1/(1 - mix), 1]);
      },
      in: function (matrix, mix) {
        mat4.scale(matrix, [1/mix, mix, 1]);
      }
    });
  }
  
  function SquishSpinTransition() {
    return new BaseTransition({
      out: function (matrix, mix) {
        var mix2 = mix*mix;
        var angle = mix2*TWOPI;
        mat4.rotateZ(matrix, angle);
        mat4.scale(matrix, [1-mix2, 1, 1-mix2]);
        mat4.rotateZ(matrix, -angle);
      },
      in: function (matrix, mix) {
        var mix2 = mix*mix;
        var angle = mix2*TWOPI;
        mat4.rotateZ(matrix, angle);
        mat4.scale(matrix, [mix2, 1, mix2]);
        mat4.rotateZ(matrix, -angle);
      }
    });
  }
  
  function WhirlTransition() {
    return new BaseTransition({
      out: function (matrix, mix) {
        var mix2 = mix*mix;
        var mix4 = mix2*mix2;
        mat4.rotateY(matrix, mix2*TWOPI*6);
        mat4.scale(matrix, [1 / (1 - mix4), 1, 1 / (1 - mix4)]);
      },
      in: function (matrix, mix) {
        var mix2 = mix*mix;
        var mix4 = mix2*mix2;
        mat4.rotateY(matrix, mix2*TWOPI*6);
        mat4.scale(matrix, [mix4, 1, mix4]);
      }
    });
  }
  
  var transitions = [
    SlideTransition,
    SlideTransition,
    ScaleInTransition,
    ScaleOutTransition,
    SquishShiftTransition,
    SquishCrossTransition,
    SquishSpinTransition,
    WhirlTransition
  ];
  
  // --- EffectManager ---
  
  function EffectManager(canvas, effects) {
    var effectManager = this;
    
    var frameTime = Date.now();
    var transition, transitionTime = 0;
    var previousEffectS, currentEffectS;
    
    var viewWarnings = Object.create(null);
    
    function computeView(effectS) {
      var effect = effectS.effect;
      function gvm(name, fallback) {
        if (effect[name]) {
          return effect[name]();
        } else {
          if (!viewWarnings[name]) {
            viewWarnings[name] = true;
            console.warn("Effect did not provide view parameter " + name);
          }
          return fallback;
        }
      }
      
      var distance = effect.viewDistance();
      var clipDist = effect.farClipDistance();
      
      // TODO add infinity distance (ortho)
      
      if (distance === 0) {
        var tangent = gvm("fovTangent", 1);
        var nearClip = gvm("nearClipDistance", 0.1);
        
        return ["frustum",
          distance,
          -nearClip * tangent * glw.aspectRadiusX,
           nearClip * tangent * glw.aspectRadiusX,
          -nearClip * tangent * glw.aspectRadiusY,
           nearClip * tangent * glw.aspectRadiusY,
           nearClip,
           clipDist
        ];
      } else {
        var radius = gvm("viewRadius", 1);
        var clipFrac = gvm("nearClipFraction", 0.33);
        
        return ["frustum",
          distance,
          -clipFrac * radius * glw.aspectRadiusX,
           clipFrac * radius * glw.aspectRadiusX,
          -clipFrac * radius * glw.aspectRadiusY,
           clipFrac * radius * glw.aspectRadiusY,
          distance * clipFrac,
          distance + clipDist
        ];
      }
    }
    
    function interpView() {
      if (previousEffectS) {
        if (currentEffectS) {
          var pv = computeView(previousEffectS);
          var cv = computeView(currentEffectS);
          // TODO implement ortho
          return [
            "frustum",
            interp(pv[1], cv[1], transitionTime),
            interp(pv[2], cv[2], transitionTime),
            interp(pv[3], cv[3], transitionTime),
            interp(pv[4], cv[4], transitionTime),
            interp(pv[5], cv[5], transitionTime),
            interp(pv[6], cv[6], transitionTime),
            interp(pv[7], cv[7], transitionTime)
          ];
        } else {
          return computeView(previousEffectS);
        }
      } else {
        if (currentEffectS) {
          return computeView(currentEffectS);
        } else {
          return ["ortho", 0, -1, 1, -1, 1, -1, 1];
        }
      }
    }
    
    /*var */glw = new gltoy.GLWrapper(canvas);
    var gl = glw.context;

    var resourceCache = Object.create(null);
    
    function resetStateFor(effectS, trf, mix) {
      glw.setTransition(interpView(), trf, mix); // clear transition matrix
      gl.activeTexture(gl.TEXTURE0);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      for (var i = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) - 1; i >= 0; i--)
        gl.disableVertexAttribArray(i);
      effectS.effect.setState();
    }
    
    function switchEffect(name, parameters) {
      function finish(resources) {
        if (previousEffectS) previousEffectS.effect.deleteResources();
        previousEffectS = currentEffectS;
        transition = new (randElem(transitions))();
        transitionTime = 0;
        
        resourceCache[name] = resources;
        var effectModule = effects[name];
        currentEffectS = {
          name: name,
          effect: new effectModule.Effect(parameters, glw, resources),
          frame: {
            t: 0,
            dt: 0
          }
        };
      }
      
      if (name in resourceCache) {
        // setTimeout so this isn't sometimes-synchronous
        setTimeout(function () {
          finish(resourceCache[name]);
        }, 0);
      } else {
        gltoy.fetchShaders("effects/"+name+"/", effects[name].shaders, finish);
      }
      
      effectManager.currentEffectName = name;
      effectManager.currentEffectParameters = parameters;
    }
    
    function stepS(effectS, dt) {
      effectS.frame.t += dt;
      effectS.frame.dt = dt;
      if (effectS.effect.step && dt > 0) { // TODO reconsider this condition
        resetStateFor(effectS, noop, 1);
        effectS.effect.step(effectS.frame);
      }
    }
    
    function step() {
      // TODO review step, stepS for FP stability
      var newTime = Date.now();
      var dt = (newTime - frameTime) / 1000 * effectManager.timeRate;
      frameTime = newTime;
      
      if (dt > 1) {
        // Don't jerk on resume after starvation
        dt = 0;
      } else {
        // Also maximum step size
        dt = min(dt, 1/15);
      }
      
      if (previousEffectS) {
        stepS(previousEffectS, dt);
        
        transitionTime = max(0.0, transitionTime + dt);
        if (transitionTime >= 1.0) {
          previousEffectS.effect.deleteResources();
          previousEffectS = undefined;
        }
      }
      if (currentEffectS) {
        stepS(currentEffectS, dt);
      }
    }
    
    function loop() {
      step();
      
      glw.beginFrame();
      if (previousEffectS) {
        resetStateFor(previousEffectS, transition.out, transitionTime);
        previousEffectS.effect.draw(previousEffectS.frame);
      }
      if (currentEffectS) {
        if (previousEffectS) {
          resetStateFor(currentEffectS, transition.in, transitionTime);
        } else {
          resetStateFor(currentEffectS, noop, 1);
        }
        currentEffectS.effect.draw(currentEffectS.frame);
      }
      glw.endFrame();
      window.requestAnimationFrame(loop, canvas);
    }
    
    loop();
    
    this.timeRate = 1;
    this.switchEffect = switchEffect;
  }
  
  // --- Utilities for effects ---
  
  function hsvToRGB(rgb, h, s, v) {
    // Conversion per http://en.wikipedia.org/wiki/HSL_and_HSV#Converting_to_RGB
    h = mod(h, 1);
    var c = s * v;
    var hp = h * 6;
    var x = c * (1 - abs(mod(hp, 2) - 1));
    switch (ceil(hp)) {
      case 1: rgb[0] = c; rgb[1] = x; rgb[2] = 0; break;
      case 2: rgb[0] = x; rgb[1] = c; rgb[2] = 0; break;
      case 3: rgb[0] = 0; rgb[1] = c; rgb[2] = x; break;
      case 4: rgb[0] = 0; rgb[1] = x; rgb[2] = c; break;
      case 5: rgb[0] = x; rgb[1] = 0; rgb[2] = c; break;
      case 6: rgb[0] = c; rgb[1] = 0; rgb[2] = x; break;
    }
    return rgb;
  }
  
  function randInt(bound) {
    return floor(random() * bound);
  }
  
  function randElem(array) {
    return array[randInt(array.length)];
  }
  
  function randBool() {
    return Boolean(randInt(2));
  }
  
  function mod(value, modulus) {
    return (value % modulus + modulus) % modulus;
  }
  
  // --- Export ---

  gltoy = def({
    EffectManager: EffectManager,
    fetchShaders: fetchShaders,
    GLWrapper: GLWrapper,
    hsvToRGB: hsvToRGB,
    mod: mod,
    randBool: randBool,
    randElem: randElem,
    randInt: randInt,
    Tumbler: Tumbler
  });
}());
