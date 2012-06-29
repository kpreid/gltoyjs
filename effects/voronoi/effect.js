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
  
  var TWOPI = PI * 2;
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
      coloring: randElem(["fixed", "gradient1", "gradient2", "uniform", "varying"])
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
    var ncolor;
    switch (parameters.coloring) {
      case "fixed": ncolor = parameters.numPoints * 3; break;
      case "gradient1": ncolor = 1; break;
      case "gradient2": ncolor = 1; break;
      case "uniform": ncolor = 3; break;
      case "varying": ncolor = 3; break;
      default: ncolor = 0; break;
    }
    if (ncolor > 0) {
      parameters.colors = [];
      for (var i = 0; i < ncolor; i++) {
        parameters.colors[i] = random();
      }
    }
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var numPoints = parameters.numPoints;
    var patternSeeds = parameters.patternSeeds;
    var coloring = parameters.coloring;
    var colors = parameters.colors;
    var coneVertices = parameters.metric === "manhattan" ? 4 : 50;
    var coneRadius = 3; // TODO should depend on aspect ratio
    
    var programW = glw.compile(programDesc, resources);
    
    var cverts = [0, 0, 0];
    for (var i = 0; i <= coneVertices; i += 1) {
      var j = i * TWOPI / coneVertices;
      cverts.push(coneRadius * Math.sin(j), coneRadius * Math.cos(j), -1);
    }
    var cone = new glw.BufferAndArray([{
      attrib: programW.attribs.aVertexPosition,
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
            x = sin(now * patternSeeds[sbase+0] + TWOPI * patternSeeds[sbase+1]);
            y = cos(now * patternSeeds[sbase+2] + TWOPI * patternSeeds[sbase+3]);
            break;
          case "chain":
            var theta = now * 0.5 * (1 + i/numPoints * parameters.chainSpeedRange);
            x = sin(theta);
            y = cos(theta * (1 + parameters.chainTwist / 10));
        }
        
        mat4.identity(mvMatrix);
        mat4.translate(mvMatrix, [x, y, 0]);
        glw.setModelMatrix(mvMatrix);
        
        switch (coloring) {
          case "fixed":
            gl.uniform3f(glw.uniforms.uColor, colors[i*3+0], colors[i*3+1], colors[i*3+2]);
            break;
          case "gradient1":
            gl.uniform3f(glw.uniforms.uColor, colors[0], i/numPoints, 0);
            break;
          case "gradient2":
            gl.uniform3f(glw.uniforms.uColor, 0, colors[0], i/numPoints);
            break;
          case "uniform":
            gl.uniform3f(glw.uniforms.uColor, colors[0], colors[1], colors[2]);
            break;
          case "varying":
            gl.uniform3f(glw.uniforms.uColor,
              sin(now * colors[0] + i/numPoints*PI) * 0.5 + 0.5,
              sin(now * colors[1] + i/numPoints*PI) * 0.5 + 0.5,
              sin(now * colors[2] + i/numPoints*PI) * 0.5 + 0.5
            );
            break;
        }
        
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
