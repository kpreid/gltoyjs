// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

(function () {
  "use strict";
  
  var cos = Math.cos;
  var PI = Math.PI;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  var sin = Math.sin;
  
  var patternSeedsPerPoint = 4;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
      numPoints: 2 + randInt(40),
      metric: randElem(["manhattan", "euclidean"]),
      pattern: randElem(["scatter", "chain"]),
    };
    switch (parameters.pattern) {
      case "scatter":
        parameters.patternSeeds = [];
        for (var i = 0; i < parameters.numPoints * patternSeedsPerPoint; i++) {
          parameters.patternSeeds[i] = random();
        }
        break;
      case "chain":
        parameters.chainSpeedRange = random();
        parameters.chainTwist = random();
        break;
    }
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var numPoints = parameters.numPoints;
    var patternSeeds = parameters.patternSeeds;
    var coneVertices = parameters.metric === "manhattan" ? 4 : 50;
    var coneRadius = 3; // TODO should depend on aspect ratio
    
    var programW = glw.compile(programDesc, resources);
    
    var cverts = [0, 0, 0];
    for (var i = 0; i <= coneVertices; i += 1) {
      var j = i * 2*PI / coneVertices;
      cverts.push(coneRadius * Math.sin(j), coneRadius * Math.cos(j), -1);
    }
    var cone = new glw.BufferAndArray([{
      attrib: glw.attribs.aVertexPosition,
      components: 3
    }]);
    cone.load(cverts);
    cone.send(gl.STATIC_DRAW);

    this.setState = function () {
      // mat4.ortho(-1.5, 1.5, -1.5, 1.5, 0.01, 100.0, pMatrix); // TODO
      glw.useProgramW(programW);
      gl.enable(gl.DEPTH_TEST);
    };

    this.draw = function () {
      var now = new Date().getTime() / 1000;
      
      for (var i = 0; i < numPoints; i++) {
        var x = 0, y = 0;
        var sbase = i * patternSeedsPerPoint;
        switch (parameters.pattern) {
          case "scatter":
            x = sin(now * patternSeeds[sbase+0] + PI*2 * patternSeeds[sbase+1]);
            y = cos(now * patternSeeds[sbase+2] + PI*2 * patternSeeds[sbase+3]);
            break;
          case "chain":
            var theta = now * 0.5 * (1 + i/numPoints * parameters.chainSpeedRange);
            x = sin(theta);
            y = cos(theta * (1 + parameters.chainTwist / 10));
        }
        //var x = Math.sin(2+i*10.2+now*1.1);
        //var y = Math.sin(i*17+now);

        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [x, y, 0]);
        glw.setModelMatrix(mvMatrix);

        gl.uniform4f(glw.uniforms.uColor, Math.sin(i), Math.sin(i*2), Math.sin(i*3), 1);
        cone.attrib();
        cone.draw(gl.TRIANGLE_FAN);
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
}());
