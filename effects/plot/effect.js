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
  
  function randfunc() {
    return randElem([
      "s * 2.0 - 1.0",
      "s * -2.0 + 1.0",

      "sin(s * PI * p * 48.0)",
      "cos(s * PI * p * 48.0)",
      "tan(s * PI * p * 48.0)",
      "sec(s * PI * p * 48.0)",

      "sin(t)",
      "cos(t)",
      "tan(t)",
      "sec(t)",

      "sin(s * PI * p * 48.0 + t)",
      "cos(s * PI * p * 48.0 + t)",
      "tan(s * PI * p * 48.0 + t)",
      "sec(s * PI * p * 48.0 + t)",

      "sin(1.0 / (s - 0.5) * (p * 48.0))",
      "sin(1.0 / (s - 0.5) * (p * 48.0)) + t",

      "sin(s * PI * p * 48.0) / 2.0 + sin(s * PI * 2.0)",
      "sin(s * PI * p * 48.0 + t) / 2.0 + sin(s * PI * 2.0)",
      "cos(s * PI * p * 48.0) / 2.0 + sin(s * PI * 2.0)",
      "cos(s * PI * p * 48.0 + t) / 2.0 + sin(s * PI * 2.0)",
      
      "round(s * p * 48.0) / (p * 48.0) * 2.0 - 1.0",
      "(round(s * p * 48.0 + t) - t) / (p * 48.0) * 2.0 - 1.0",
      "abs(mod(s * p * 48.0, 4.0) - 2.0) - 1.0", // sawtooth
      "abs(mod(s * p * 48.0 + t, 4.0) - 2.0) - 1.0",
      
      "tan(ess) + 2.0 * sin(-mod(ess + PI/2.0, PI) + PI/2.0)",
      "tan(esst) + 2.0 * sin(-mod(esst + PI/2.0, PI) + PI/2.0)"
    ]);
  }
  
  function pickParam(previous) {
     switch (isFinite(previous) ? randInt(5) : 0) {
       case 0: return random();
       case 1: return previous;
       case 2: return previous * (2 + randInt(5));
       case 3: return previous / (2 + randInt(5));
       case 4: return previous * PI;
    }
  }
  
  exports.configure = function () {
    var parameters = {
      tumbler: gltoy.Tumbler.configure(),
      functions: {
        x: randfunc(),
        y: randfunc(),
        z: randfunc(),
        r: randfunc(),
        g: randfunc(),
        b: randfunc()
      },
      funcParams: {}
    };
    var p = parameters.funcParams;
    p.x = pickParam();
    p.y = pickParam(p.x);
    p.z = pickParam(p.y);
    p.r = pickParam(p.z);
    p.g = pickParam(p.r);
    p.b = pickParam(p.g);
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var numPoints = 10000; //parameters.numPoints;
    
    var programW = glw.compile(programDesc, resources, {
      FX: parameters.functions.x,
      FY: parameters.functions.y,
      FZ: parameters.functions.z,
      FR: parameters.functions.r,
      FG: parameters.functions.g,
      FB: parameters.functions.b,
      PX: parameters.funcParams.x,
      PY: parameters.funcParams.y,
      PZ: parameters.funcParams.z,
      PR: parameters.funcParams.r,
      PG: parameters.funcParams.g,
      PB: parameters.funcParams.b
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
  exports.Effect.prototype.viewRadius = function () { return 6; }; // TODO this should be able to be 1; view calculation must be wrong
  exports.Effect.prototype.nearClipFraction = function () { return 0.1; };
  exports.Effect.prototype.farClipDistance = function () { return 10000; };
}());
