// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

/* TODO: Add in all the features and characteristics from the original GLToy version:
  * Wandering off the origin.
  * Disable depth test for planar conditions.
*/

(function () {
  "use strict";
  
  var ceil = Math.ceil;
  var cos = Math.cos;
  var floor = Math.floor;
  var hsvToRGB = gltoy.hsvToRGB;
  var mod = gltoy.mod;
  var PI = Math.PI;
  var pow = Math.pow;
  var randBool = gltoy.randBool;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  var sin = Math.sin;
  
  var TWOPI = PI * 2;
  var HALFPI = PI / 2;
  var QUARTERPI = PI / 4;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
      tumbler: gltoy.Tumbler.configure(),
      length: 10 + randInt(1000),
      motion: randElem(["sine", "bend", "curl"]),
      motionPar: {},
      shape: randElem(["diamond", "line", "triangle", "sphere"]),
      coloring: randElem(["q", "r"/*, "θ"*/]),
      scale: 0.005 + 0.1 * random(),
      copies: 1 + randInt(6),
      lighting: randBool(),
      oneSided: randBool(),
      blend: randBool()
    };
    switch (parameters.motion) {
      case "sine":
        if (randBool()) parameters.motionPar.rotX = true;
        if (randBool()) parameters.motionPar.rotY = true;
        if (randBool()) parameters.motionPar.rotZ = true;
        if (randBool()) parameters.motionPar.transX = true;
        if (randBool()) parameters.motionPar.transY = true;
        if (randBool()) parameters.motionPar.transZ = true;
        break;
      case "bend":
        parameters.motionPar.divisions = 3 + randInt(4);
        break;
      case "curl":
        parameters.motionPar.whorls = randInt(50);
        parameters.motionPar.speed = pow(2, -3 + random() * 5);
        parameters.motionPar.skew = randBool() ? 0 : random() * HALFPI;
        break;
    }
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    var tumbler = new gltoy.Tumbler(parameters.tumbler);
    
    var chainLength = parameters.length;
    var copies = parameters.copies;
    var coloring = parameters.coloring;

    var chainMatrix = mat4.create();
    var motion = new motions[parameters.motion](chainMatrix, chainLength, parameters.motionPar);
    
    var sphereLats = 5;
    var sphereLons = 6;
    
    var nh = 1;
    var nz = 1;
    var shapeVertices = [];
    var shapePrimitive;
    var shapeCanBeLit;
    for (var copy = 0; copy < copies; copy++) {
      var ang = copy * (TWOPI/copies);
      switch (parameters.shape) {
        case "diamond":
          shapePrimitive = gl.TRIANGLES;
          shapeCanBeLit = true;
          shapeVertices.push(
             0, 2, 0, 0, 0, 1, ang,
            -1, 1, 0, 0, 0, 1, ang,
             1, 1, 0, 0, 0, 1, ang,
             1, 1, 0, 0, 0, 1, ang,
            -1, 1, 0, 0, 0, 1, ang,
             0, 0, 0, 0, 0, 1, ang
          );
          break;
        case "line":
          shapePrimitive = gl.LINES;
          shapeCanBeLit = false;
          shapeVertices.push(
             0, 0, 0, 0, 0, 1, ang,
             0, 2, 0, 0, 0, 1, ang
          );
          break;
        case "triangle":
          shapePrimitive = gl.TRIANGLES;
          shapeCanBeLit = true;
          shapeVertices.push(
             0, 2, 0, 0, 0, 1, ang,
            -1, 0, 0, 0, 0, 1, ang,
             1, 0, 0, 0, 0, 1, ang
          );
          break;
        default: (function () {
          shapePrimitive = gl.TRIANGLES;
          shapeCanBeLit = true;
          function spherePoint(i, j) {
            var lat = i / sphereLats * PI;
            var lon = (j % sphereLons) / sphereLons * TWOPI;
            shapeVertices.push(
              sin(lon) * sin(lat),
              cos(lon) * sin(lat),
              cos(lat));
          }
          for (var i = 0; i < sphereLats; i++) {
            for (var j = 0; j < sphereLons; j++) {
              spherePoint(i,   j  ); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
              spherePoint(i,   j+1); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
              spherePoint(i+1, j  ); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
              spherePoint(i+1, j  ); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
              spherePoint(i,   j+1); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
              spherePoint(i+1, j+1); spherePoint(i+0.5, j+0.5); shapeVertices.push(ang);
            }
          }
        })(); break;
      }
    }
    
    var programW = glw.compile(programDesc, resources, {
      LIGHTING: shapeCanBeLit && parameters.lighting
    });
    
    var shape = new glw.BufferAndArray([
      {
        attrib: programW.attribs.aPosition,
        components: 3
      },
      {
        attrib: programW.attribs.aNormal,
        components: 3
      },
      {
        attrib: programW.attribs.aRepeatAngle,
        components: 1
      }
    ]);
    shape.load(shapeVertices);
    shape.send(gl.STATIC_DRAW);

    this.setState = function () {
      glw.useProgramW(programW);
      if (parameters.blend) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE)
      } else {
        gl.enable(gl.DEPTH_TEST);
      }
      if (parameters.oneSided || parameters.shape === "sphere") {
        gl.enable(gl.CULL_FACE);
      }
    };
    
    this.step = function (frame) {
      motion.step(frame);
    };
    
    var translation = vec3.createFrom(0, 2, 0);
    var hsvbuf = vec3.create();
    
    this.draw = function (frame) {
      var t = frame.t;
      
      mat4.identity(mvMatrix);
      tumbler.apply(mvMatrix, t);
      mat4.scale(mvMatrix, [parameters.scale, parameters.scale, parameters.scale]);
      glw.setModelMatrix(mvMatrix);

      mat4.identity(chainMatrix);
      for (var i = 0; i < chainLength; i++) {
        gl.uniformMatrix4fv(glw.uniforms.uChainMatrix, false, chainMatrix);
        
        switch (coloring) {
          case "q":
            var q = i * 0.753 + t;
            gl.uniform3f(glw.uniforms.uColor,
              sin(mod(q, PI*2.0) * 1.0 + PI * 0.0/6) / 2 + 0.5,
              sin(mod(q, PI*2.2) * 1.1 + PI * 4.0/6) / 2 + 0.5,
              sin(mod(q, PI*2.4) * 1.2 + PI * 8.0/6) / 2 + 0.5);
            break;
          case "r":
            hsvToRGB(hsvbuf, (i + t) / chainLength, 1, 1);
            gl.uniform3fv(glw.uniforms.uColor, hsvbuf);
            break;
          // TODO: can't do this because the copy is on GPU side here
          //case "θ":
          //  hsvToRGB(hsvbuf, (copy + t / 3) / copies, 1, 1);
          //  gl.uniform3fv(glw.uniforms.uColor, hsvbuf);
          //  break;
        }
        
        mat4.translate(chainMatrix, translation);
        motion.apply(t, i);
        
        shape.attrib();
        shape.draw(shapePrimitive);
      }
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      shape.deleteResources();
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 6; };
  exports.Effect.prototype.viewRadius = function () { return 1; };
  exports.Effect.prototype.nearClipFraction = function () { return .01; };
  exports.Effect.prototype.farClipDistance = function () { return 400; };
  
  var motions = Object.create(null);
  motions.sine = SineMotion;
  motions.bend = BendMotion;
  motions.curl = CurlMotion;
  
  function SineMotion(matrix, chainLength, parameters) {
    var rotX   = parameters.rotX;
    var rotY   = parameters.rotY;
    var rotZ   = parameters.rotZ;
    var transX = parameters.transX;
    var transY = parameters.transY;
    var transZ = parameters.transZ;
    
    this.apply = function (t, i) {
      var p = t / 4;
      if (transX) mat4.translate(matrix, [sin(p / 5.5 + i * 23), 0, 0]);
      if (transY) mat4.translate(matrix, [0, sin(p / 6.5 + i * 33), 0]);
      if (transZ) mat4.translate(matrix, [0, 0, sin(p / 9.5 + i * 43)]);
      if (rotX) mat4.rotateX(matrix, sin(p / 5.0 + i*i * 0.2) * HALFPI);
      if (rotY) mat4.rotateY(matrix, sin(p / 6.0 + i*i * 0.3) * HALFPI);
      if (rotZ) mat4.rotateZ(matrix, sin(p / 9.0 + i*i * 0.4) * HALFPI);
      if (rotX) mat4.rotateX(matrix, sin(p / 1.0 + i*i * 23 ) * QUARTERPI);
      if (rotY) mat4.rotateY(matrix, sin(p / 1.2 + i*i * 24 ) * QUARTERPI);
      if (rotZ) mat4.rotateZ(matrix, sin(p / 1.4 + i*i * 25 ) * QUARTERPI);
    };
  }
  SineMotion.prototype.step = function (frame) {};
  
  function BendMotion(matrix, chainLength, parameters) {
    var statePerLink = 2;
    var divisions = parameters.divisions;
    var state = new Float32Array(chainLength * statePerLink);
    var current = randInt(state.length);
    var velocity = TWOPI;
    var mult = HALFPI;
    
    function nonzeroPreference() {
      return !randInt(4);
    }
    
    // TODO add state initialization
    
    this.step = function (frame) {
      var rounder = velocity < 0 ? ceil : floor;
      var sector = rounder(state[current] / mult);
      
      state[current] += velocity * frame.dt;
      
      if (rounder(state[current] / mult) != sector) {
        state[current] = rounder(state[current] / mult) * mult;
        
        current = randInt(state.length);
        velocity = 0.03 + random() * 3.47 * HALFPI * (randBool() ? 1 : -1);
        if (nonzeroPreference() || mod(state[current], TWOPI) === 0) {
          mult = TWOPI / divisions;
        } else {
          mult = TWOPI;
        }
      }
    };
    
    this.apply = function (t, i) {
      mat4.rotateX(matrix, state[i*statePerLink]);
      mat4.rotateZ(matrix, state[i*statePerLink+1]);
    };
  }
  
  function CurlMotion(matrix, chainLength, parameters) {
    var numWhorls = parameters.whorls;
    var rippleSpeed = parameters.speed;
    var skew = parameters.skew;
    
    this.apply = function (t, i) {
      mat4.rotateX(matrix,
         (i / chainLength * TWOPI * numWhorls) + (t * rippleSpeed));
      mat4.rotateZ(matrix, skew);
    };
  }
  CurlMotion.prototype.step = function (frame) {};
}());
