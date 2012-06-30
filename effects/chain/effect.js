// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

(function () {
  "use strict";
  
  var cos = Math.cos;
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
      length: 50,
      motion: randElem(["sine", "bend", "curl"]),
      motionPar: {},
      scale: 0.05,
      copies: 1 + randInt(6)
    };
    parameters.motion = "sine";
    parameters.tumbler = { type: "rotY" };
    switch (parameters.motion) {
      case "sine":
        if (randBool()) parameters.motionPar.rotX = true;
        if (randBool()) parameters.motionPar.rotY = true;
        if (randBool()) parameters.motionPar.rotZ = true;
        if (randBool()) parameters.motionPar.transX = true;
        if (randBool()) parameters.motionPar.transY = true;
        if (randBool()) parameters.motionPar.transZ = true;
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

    var chainMatrix = mat4.create();
    var motion = new motions[parameters.motion](chainMatrix, chainLength, parameters.motionPar);
    
    var coneVertices = 4;
    var coneRadius = 1;
    var coneSlope = 2;
    
    var programW = glw.compile(programDesc, resources, {
      LIGHTING: true
    });
    
    var nh = 1;
    var nz = 1;
    var cverts = [];
    for (var copy = 0; copy < copies; copy++) {
      var ang = copy * (TWOPI/copies);
      for (var i = 0; i <= coneVertices; i += 1) {
        var j = i * TWOPI / coneVertices;
        var jn = (i+1) * TWOPI / coneVertices;
        var s = sin(j);
        var c = cos(j);
        var sn = sin(jn);
        var cn = cos(jn);
        cverts.push(
          coneRadius * s, coneRadius * c, -coneRadius / coneSlope, nh * s, nh * c, nz, ang,
          0, 0, 0, nh * s, nh * c, nz, ang,
          coneRadius * sn, coneRadius * cn, -coneRadius / coneSlope, nh * sn, nh * cn, nz, ang
          //0, 0, 0, nh * sn, nh * cn, nz, ang
        );
      }
    }
    var cone = new glw.BufferAndArray([
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
    cone.load(cverts);
    cone.send(gl.STATIC_DRAW);

    this.setState = function () {
      // mat4.ortho(-1.5, 1.5, -1.5, 1.5, 0.01, 100.0, pMatrix); // TODO
      glw.useProgramW(programW);
      gl.enable(gl.DEPTH_TEST);
    };
    
    var translation = vec3.createFrom(0, 2, 0);
    
    this.draw = function (frame) {
      var t = frame.t;
      
      mat4.identity(mvMatrix);
      tumbler.apply(mvMatrix, t);
      mat4.scale(mvMatrix, [parameters.scale, parameters.scale, parameters.scale]);
      glw.setModelMatrix(mvMatrix);

      mat4.identity(chainMatrix);
      for (var i = 0; i < chainLength; i++) {
        mat4.translate(chainMatrix, translation);
        motion.apply(t, i);
        
        gl.uniform3f(glw.uniforms.uColor, 1, i/chainLength, 0);
        gl.uniformMatrix4fv(glw.uniforms.uChainMatrix, false, chainMatrix);
        
        cone.attrib();
        cone.draw(gl.TRIANGLES);
      }
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      cone.deleteResources();
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 20; };
  exports.Effect.prototype.viewRadius = function () { return 1; };
  exports.Effect.prototype.nearClipFraction = function () { return 0.9; };
  exports.Effect.prototype.farClipDistance = function () { return 2; };
  
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
  
  function BendMotion(matrix, chainLength, parameters) {
    this.apply = function (t, i) {
      // TODO
    };
  }
  
  function CurlMotion(matrix, chainLength, parameters) {
    var numWhorls = 1; // TODO parameterize
    var rippleSpeed = 1;
    var skew = 0;
    
    this.apply = function (t, i) {
      mat4.rotateX(matrix,
         (i / chainLength * TWOPI * numWhorls) + (t * rippleSpeed));
      mat4.rotateZ(matrix, skew);
    };
  }
}());
