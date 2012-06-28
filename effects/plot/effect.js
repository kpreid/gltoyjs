// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

(function () {
  "use strict";
  
  var PI = Math.PI;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
      tumbler: gltoy.Tumbler.configure()
    };
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var numPoints = 500; //parameters.numPoints;
    
    var programW = glw.compile(programDesc, resources, {
      FX: "sin(s*30.0)",
      FY: "cos(s*30.0)",
      FZ: "s",
      FR: "1.0",
      FG: "0.0",
      FB: "sin(t)"
    });
    var tumbler = new gltoy.Tumbler(parameters.tumbler);
    
    // Generate buffer
    var array = new Float32Array(numPoints);
    var indexScale = 1 / (numPoints - 1);
    for (var i = 0; i < numPoints; i++) {
      array[i] = i * indexScale;
    }
    var plot = new glw.BufferAndArray([{
      attrib: glw.attribs.aT,
      components: 2
    }]);
    plot.array = array;
    plot.send(gl.STATIC_DRAW);

    this.setState = function () {
      glw.useProgramW(programW);
    };

    var start = Date.now() / 1000;
    this.draw = function () {
      mat4.identity(mvMatrix);
      tumbler.apply(mvMatrix, Date.now() / 1000 - start); // TODO general time framework
      mat4.scale(mvMatrix, [3, 3, 3]);
      glw.setModelMatrix(mvMatrix);

      gl.uniform1f(programW.uniforms.uTime, Date.now() / 1000 - start);
      plot.attrib();
      plot.draw(gl.LINE_STRIP);
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      plot.deleteResources();
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 20; };
  exports.Effect.prototype.viewRadius = function () { return 3; }; // TODO this should be able to be 1; view calculation must be wrong
  exports.Effect.prototype.nearClipFraction = function () { return 0.1; };
  exports.Effect.prototype.farClipDistance = function () { return 10000; };
}());
