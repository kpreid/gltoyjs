// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

/* TODO: Add in all the features and characteristics from the original GLToy version:
  * Per-particle colors.
  
  * Line shape.
  * Rotating triangle shape.
  * Use triangles instead of points so as to not have the clipping problem.
  
  * Take a look at the incomplete "fountain" motion.
  
  * Whatever the HSV thing is.
  
  * Close/far camera.
  * Speed modifier.
  
  * Fog for far clip.
*/

(function () {
  "use strict";
  
  var cos = Math.cos;
  var floor = Math.floor;
  var PI = Math.PI;
  var pow = Math.pow;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  var sin = Math.sin;
  var sqrt = Math.sqrt;
  
  function sinrange(a, b, t) {
    return a + (sin(t) + 1) / 2 * (b - a);
  }
  
  function pickDirection(dir) {
    var magsqr, j;
    var dims = dir.length;

    do {
      magsqr = 0;
      for (j = 0; j < dims; j++) {
        dir[j] = random() * 2 - 1;
        magsqr += dir[j] * dir[j];
      }
    } while (magsqr > 1 || magsqr < 0.001);

    var mag = sqrt(magsqr);
    for (j = 0; j < dims; j++) dir[j] = dir[j] / mag;
  }
  
  
  var numStateComponents = 2;
  
  exports.shaders = {
    vertex: ["plotVertex.glsl", "updateVertex.glsl"],
    fragment: ["plotFragment.glsl", "updateFragment.glsl"]
  };
  
  exports.configure = function () {
    var parameters = {
      numParticles: 10000,
      shape: randElem(["square", "soft"]),
      motion: randElem(["harmonic", "warp", "spray"])
    };
    return parameters;
  };
  
  function makeSprayEmitter(state, frame) {
    var speed = sinrange(0.0, 0.4, frame.t);
    var ex = sin(frame.t / 5);
    var ey = sin(frame.t / 7);
    var ez = sin(frame.t / 4);
    return function () {
      state[0] = ex;
      state[1] = ey;
      state[2] = ez;
      state[3] = 1;
      state[4] = (random() - 0.5) * speed * 2;
      state[5] = (random() - 0.5) * speed * 2;
      state[6] = (random() - 0.5) * speed * 2;
      state[7] = 1;
    };
  }
  function makeSprayInitializer(state) {
    var dirbuf = vec3.create();
    return function (base) {
      var vary = random();
      // TODO initial speed factor
      var speed = vary * 3 + 1;
      pickDirection(dirbuf);
      state[base + 0] = 0;
      state[base + 1] = 0;
      state[base + 2] = 0;
      state[base + 3] = 1;
      state[base + 4] = dirbuf[0] * speed;
      state[base + 5] = dirbuf[1] * speed;
      state[base + 6] = dirbuf[2] * speed;
      state[base + 7] = 1;
    };
  }
  
  var motions = Object.create(null);
  motions.harmonic = {
    initializer: makeSprayInitializer,
    emitRate: 0.03,
    emitter: makeSprayEmitter,
    harmonicAccel: function (t) {
      return sinrange(-0.2, -2, t * 0.1);
    }
  };
  motions.spray = {
    initializer: makeSprayInitializer,
    emitRate: 0.015,
    emitter: makeSprayEmitter,
    harmonicAccel: function (t) { return 0; }
  };
  motions.warp = {
    // TODO near view mode
    initializer: makeSprayInitializer,
    emitRate: 0.03,
    emitter: function (state, frame) {
      return function () {
        state[0] = random() * 10 - 5;
        state[1] = random() * 10 - 5;
        state[2] = -2;
        state[3] = 1;
        state[4] = 0;
        state[5] = 0;
        state[6] = 0.3;
        state[7] = 1;
      };
    },
    harmonicAccel: function (t) {
      return 0;
    }
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    if (!gl.getExtension("OES_texture_float")) {
      // TODO make loader handle effect crashing
      throw new Error("Floating-point textures required");
    }
    
    var modelMatrix = mat4.create();
    mat4.identity(modelMatrix);
    
    var shape = parameters.shape;
    var motion = motions[parameters.motion];
    
    var numParticles = parameters.numParticles;
    var stateTexSize = 1;
    while (stateTexSize * stateTexSize < numParticles * numStateComponents) {
      stateTexSize *= 2;
    }
    if (typeof console !== "undefined") {
      console.log("Texture size: " + stateTexSize + "×" + stateTexSize + "=" + stateTexSize*stateTexSize + " vec4s (needed " + numStateComponents * numParticles + ")");
    }
    
    function particleTexSpix(i) {
      return ((i * numStateComponents) % stateTexSize);
    }
    function particleTexTpix(i) {
      return floor((i * numStateComponents)/stateTexSize);
    }
    
    var plotProgramW = glw.compile({
      vertex: ["plotVertex.glsl"],
      fragment: ["plotFragment.glsl"]
    }, resources, {
      SHAPE_SOFT: shape === "soft"
    });
    glw.useProgramW(plotProgramW);
    gl.uniform1f(glw.uniforms.uResolution, stateTexSize);
    gl.uniform1f(glw.uniforms.uPointSize, shape === "soft" ? 20 : 10);
    
    var updateProgramW = glw.compile({
      vertex: ["updateVertex.glsl"],
      fragment: ["updateFragment.glsl"]
    }, resources, {});
    glw.useProgramW(updateProgramW);
    gl.uniform1f(glw.uniforms.uResolution, stateTexSize);
    
    // Generate state textures
    function makeTexture(array) {
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);// TODO debug only
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, stateTexSize, stateTexSize, 0, gl.RGBA, gl.FLOAT, array);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return texture;
    }
    var initialStateArray = new Float32Array(stateTexSize * stateTexSize * 4);
    var initializer = motion.initializer(initialStateArray);
    for (var i = 0; i < numParticles; i++) {
      var base = i*4*numStateComponents;
      initializer(base);
      //// position
      ////initialStateArray[base+0] = 3 * (i / (numParticles-1) - 0.5);
      ////initialStateArray[base+1] = 1.5 * ((i % Math.sqrt(numParticles)) / Math.sqrt(numParticles) - 0.5);
      //initialStateArray[base+1] = sin(i);
      //initialStateArray[base+2] = cos(i);
      //initialStateArray[base+0] = 3 * (i/numParticles - 0.5);
      //initialStateArray[base+3] = 1;
      //// velocity
      //initialStateArray[base+5] = 1.0 * cos(i);
      //initialStateArray[base+6] = 1.0 * -sin(i);
      //initialStateArray[base+4] = 0;
      //initialStateArray[base+7] = 1;
    }
    var stateTexture = makeTexture(initialStateArray);
    var nextStateTexture = makeTexture(null);
    
    // Generate buffers
    var array = new Float32Array(numParticles * 2);
    for (var i = 0; i < numParticles; i++) {
      array[i*2+0] = particleTexSpix(i) / stateTexSize;
      array[i*2+1] = particleTexTpix(i) / stateTexSize;
    }
    var indexes = new glw.BufferAndArray([{
      attrib: plotProgramW.attribs.aTexCoord,
      components: 2
    }]);
    indexes.array = array;
    indexes.send(gl.STATIC_DRAW);

    var array = new Float32Array(numParticles * 2);
    for (var i = 0; i < numParticles; i++) {
      var index = i*numStateComponents;
      array[i*2] = (index % stateTexSize) / stateTexSize;
      array[i*2+1] = floor(index/stateTexSize) / stateTexSize;
    }
    var quad = new glw.BufferAndArray([{
      attrib: updateProgramW.attribs.aPosition,
      components: 2
    }]);
    quad.load([
      -1, -1,
      +1, -1,
      -1, +1,
      +1, -1
    ]);
    quad.send(gl.STATIC_DRAW);
    
    // Framebuffer for updates
    var framebuffer = gl.createFramebuffer();
    
    var nextEmit = 0;
    var emitStateBuf = new Float32Array(numStateComponents * 4);
    
    this.step = function (frame) {
      gl.disable(gl.BLEND);
      
      // Emit particles
      (function () {
        var emitCount = motion.emitRate * frame.dt * numParticles;
        var emitter = motion.emitter(emitStateBuf, frame);
        for (var ep = 0; ep < emitCount; ep++) {
          emitter();
          gl.bindTexture(gl.TEXTURE_2D, stateTexture);
          gl.texSubImage2D(gl.TEXTURE_2D, 0, particleTexSpix(nextEmit), particleTexTpix(nextEmit), numStateComponents, 1, gl.RGBA, gl.FLOAT, emitStateBuf);
          nextEmit = (nextEmit + 1) % numParticles;
        }
      }());
      
      // Perform step
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, nextStateTexture, 0);
      // console.log(WebGLDebugUtils.glEnumToString(gl.checkFramebufferStatus(gl.FRAMEBUFFER)));
        
        gl.clear(gl.COLOR_BUFFER_BIT);
        // TODO I have no idea why the viewport needs to be oversized like this
        gl.viewport(0, 0, stateTexSize * 2, stateTexSize * 2);
        
        glw.useProgramW(updateProgramW);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, stateTexture);
        gl.uniform1i(glw.uniforms.uState, 0);

        gl.uniform1f(glw.uniforms.uDT, frame.dt);
        gl.uniform1f(glw.uniforms.uHarmonicAccel, motion.harmonicAccel(frame.t));
        
        quad.attrib();
        quad.draw(gl.TRIANGLE_STRIP);
        quad.unattrib();
        
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      
      var t = nextStateTexture;
      nextStateTexture = stateTexture;
      stateTexture = t;
    }
    
    this.setState = function () {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    };

    this.draw = function (frame) {
      glw.setModelMatrix(modelMatrix);
      
      glw.useProgramW(plotProgramW);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stateTexture);
      gl.uniform1i(glw.uniforms.uState, 0);
      
      indexes.attrib();
      indexes.draw(gl.POINTS);
      indexes.unattrib();
    };
    
    this.deleteResources = function () {
      plotProgramW.deleteResources();
      indexes.deleteResources();
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 4; };
  exports.Effect.prototype.viewRadius = function () { return 1; };
  exports.Effect.prototype.nearClipFraction = function () { return 0.0001; };
  exports.Effect.prototype.farClipDistance = function () { return 10000; };
}());
