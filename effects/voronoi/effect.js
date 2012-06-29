// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.
// TODO: Figure out why we're getting flat-shading (especially in manhattan mode), even though varyings are interpolated.

(function () {
  "use strict";
  
  var atan = Math.atan;
  var cos = Math.cos;
  var PI = Math.PI;
  var pow = Math.pow;
  var randBool = gltoy.randBool;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  var sin = Math.sin;
  
  var TWOPI = PI * 2;
  var patternSeedsPerPoint = 4;
  var coneSlope = 4;
  function hypot(x, y) {
    return Math.sqrt(x*x + y*y);
  }
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
      timeOrigin: pow(10, randInt(5)),
      numPoints: 2 + randInt(40),
      metric: randElem(["manhattan", "euclidean", "euclidean", "euclidean"]),
      pattern: randElem(["scatter", "chain"]),
      coloring: randElem(["fixed", "gradient1", "gradient2", "uniform", "varying"]),
      lighting: randBool()
    };
    if (parameters.timeOrigin === 1) parameters.timeOrigin = 0;
    if (parameters.coloring === "uniform") parameters.lighting = true;
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
    var timeOrigin = parameters.timeOrigin;
    
    var coneVertices = parameters.metric === "manhattan" ? 4 : 100;
    var coneRadius = (parameters.metric === "manhattan"
        ? glw.aspectRadiusX + glw.aspectRadiusY
        : hypot(glw.aspectRadiusX, glw.aspectRadiusY)
    ) * 2;
    
    var programW = glw.compile(programDesc, resources, {
      LIGHTING: parameters.lighting
    });
    
    var nh = cos(atan(coneRadius));
    var nz = sin(atan(coneRadius));
    var cverts = [];
    for (var i = 0; i <= coneVertices; i += 1) {
      var j = i * TWOPI / coneVertices;
      var s = sin(j);
      var c = cos(j);
      //console.log(Math.sqrt(nh*nh*s*s + nh*c*nh*c + nz*nz), 
      //            Math.sqrt(nh*nh*s*s + nh*nh*c*c + nz*nz), Math.sqrt(s*s + c*c));
      cverts.push(
        coneRadius * s, coneRadius * c, -coneRadius / coneSlope, nh * s, nh * c, nz,
        0, 0, 0, nh * s, nh * c, nz
      );
    }
    var cone = new glw.BufferAndArray([
      {
        attrib: programW.attribs.aPosition,
        components: 3
      },
      {
        attrib: programW.attribs.aNormal,
        components: 3
      }
    ]);
    cone.load(cverts);
    cone.send(gl.STATIC_DRAW);

    this.setState = function () {
      // mat4.ortho(-1.5, 1.5, -1.5, 1.5, 0.01, 100.0, pMatrix); // TODO
      glw.useProgramW(programW);
      gl.enable(gl.DEPTH_TEST);
    };

    this.draw = function (frame) {
      var now = frame.t + timeOrigin;
      
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
        mat4.translate(mvMatrix, [x * glw.aspectRadiusX, y * glw.aspectRadiusY, 0]);
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
        cone.draw(gl.TRIANGLE_STRIP);
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
