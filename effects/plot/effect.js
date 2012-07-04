// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

/* TODO: Add in all the features and characteristics from the original GLToy version:
  * Draw as points instead of lines.
  * Draw with blending.
  * More frequently choose the no-tumble option.
  * Cylindrical and spherical coordinate systems.
*/

(function () {
  "use strict";
  
  var PI = Math.PI;
  var pow = Math.pow;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  var sparkVertices = [
    [0, -1],
    [0, +1],
    [1, -1],
    [0, +1],
    [1, -1],
    [1, +1]
  ];
  
  function randfunc(param) {
    var funcText = randElem([
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
      "sin(1.0 / (s - 0.5) * (p * 48.0) + t)",

      "sin(s * PI * p * 48.0) / 2.0 + sin(s * PI * 2.0)",
      "sin(s * PI * p * 48.0 + t) / 2.0 + sin(s * PI * 2.0)",
      "cos(s * PI * p * 48.0) / 2.0 + sin(s * PI * 2.0)",
      "cos(s * PI * p * 48.0 + t) / 2.0 + sin(s * PI * 2.0)",
      
      "round(s * p * 48.0) / (p * 48.0) * 2.0 - 1.0",
      "(round(s * p * 48.0 + t) - t) / (p * 48.0) * 2.0 - 1.0",
      "abs(mod(s * p * 48.0, 4.0) - 2.0) - 1.0", // sawtooth
      "abs(mod(s * p * 48.0 + t, 4.0) - 2.0) - 1.0",
      
      "tan(s * PI * p * 48.0) + 2.0 * sin(-mod(s * PI * p * 48.0 + PI/2.0, PI) + PI/2.0)",
      "tan(s * PI * p * 48.0 + t) + 2.0 * sin(-mod(s * PI * p * 48.0 + t + PI/2.0, PI) + PI/2.0)"
    ]);
    
    funcText = funcText.replace(/\bp\b/g, param.toString());
    
    return funcText;
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
    var px = pickParam();
    var py = pickParam(px);
    var pz = pickParam(py);
    var pr = pickParam(pz);
    var pg = pickParam(pr);
    var pb = pickParam(pg);

    var parameters = {
      tumbler: gltoy.Tumbler.configure(),
      functions: {
        x: randfunc(px),
        y: randfunc(py),
        z: randfunc(pz),
        r: randfunc(pr),
        g: randfunc(pg),
        b: randfunc(pb)
      },
      spark: Boolean(randInt(2))
    };
    
    //parameters.spark = true;
    //parameters.tumbler = {type: "rotY"};
    //parameters.functions.x = "sin(s*50.0)";
    //parameters.functions.y = "cos(s*50.0)";
    //parameters.functions.z = "s";
    
    if (parameters.spark) {
      parameters.sparkSpeed = random() * 0.1 - 0.05;
      parameters.sparkScale = 0.3 * random();
      parameters.sparkLength = pow(random() + 0.1, 3) * 0.01;
    }
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var numPoints = 10000; //parameters.numPoints;
    
    var pdefs = {
      FX: parameters.functions.x,
      FY: parameters.functions.y,
      FZ: parameters.functions.z,
      FR: parameters.functions.r,
      FG: parameters.functions.g,
      FB: parameters.functions.b,
      SPARK: false,
      SPARK_SPEED: parameters.sparkSpeed,
      SPARK_SCALE: parameters.sparkScale
    };
    var plotProgramW = glw.compile(programDesc, resources, pdefs);
    if (parameters.spark) {
      pdefs.SPARK = true;
      var sparkProgramW = glw.compile(programDesc, resources, pdefs);
    }

    var tumbler = new gltoy.Tumbler(parameters.tumbler);
    
    // Generate buffers
    var array = new Float32Array(numPoints);
    var indexScale = 1 / (numPoints - 1);
    for (var i = 0; i < numPoints; i++) {
      array[i] = i * indexScale;
    }
    var plot = new glw.BufferAndArray([{
      attrib: plotProgramW.attribs.aS,
      components: 1
    }]);
    plot.array = array;
    plot.send(gl.STATIC_DRAW);

    if (parameters.spark) {
      var numSparkPoints = Math.max(2, Math.ceil(numPoints * parameters.sparkLength));
      array = new Float32Array(numSparkPoints * sparkVertices.length * 3);
      var sparkIndexScale = 1 / (numSparkPoints - 2) * parameters.sparkLength;
      var sparkCoordScale = 1 / numSparkPoints;
      var j = 0;
      for (var i = 0; i < numSparkPoints; i++) {
        for (var j = 0; j < sparkVertices.length; j++) {
          var sv = sparkVertices[j];
          var base = (i*sparkVertices.length + j) * 3;
          array[base    ] = (i + sv[0]) * indexScale;
          array[base + 1] = (i + sv[0]) * sparkCoordScale;
          array[base + 2] = sv[1];
        }
      }
      var spark = new glw.BufferAndArray([
        {
          attrib: sparkProgramW.attribs.aS,
          components: 1
        },
        {
          attrib: sparkProgramW.attribs.aSparkCoord,
          components: 2
        }
      ]);
      spark.array = array;
      spark.send(gl.STATIC_DRAW);
    }

    this.setState = function () {
      gl.enable(gl.DEPTH_TEST);
      gl.blendFunc(gl.ONE, gl.ONE);
    };

    this.draw = function (frame) {
      mat4.identity(mvMatrix);
      tumbler.apply(mvMatrix, frame.t);
      mat4.scale(mvMatrix, [3, 3, 3]);
      glw.setModelMatrix(mvMatrix);
      
      glw.useProgramW(plotProgramW);
      gl.uniform1f(plotProgramW.uniforms.uTime, frame.t);
      plot.attrib();
      plot.draw(gl.LINE_STRIP);

      if (parameters.spark) {
        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        glw.useProgramW(sparkProgramW);
        gl.uniform1f(sparkProgramW.uniforms.uTime, frame.t);
        spark.attrib();
        spark.draw(gl.TRIANGLES);
        spark.unattrib();
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
      }
    };
    
    this.deleteResources = function () {
      plotProgramW.deleteResources();
      if (sparkProgramW) sparkProgramW.deleteResources();
      plot.deleteResources();
      if (spark) spark.deleteResources();
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 20; };
  exports.Effect.prototype.viewRadius = function () { return 6; }; // TODO this should be able to be 1; view calculation must be wrong
  exports.Effect.prototype.nearClipFraction = function () { return 0.1; };
  exports.Effect.prototype.farClipDistance = function () { return 10000; };
}());
