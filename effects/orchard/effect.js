// Copyright 2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

(function () {
  "use strict";

  var randint = gltoy.randint;
  var random = Math.random;
  var sqrt = Math.sqrt;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var colorPermutation = randint(6);
    var brightness = 0.06 + random() * 0.74;
    
    return {
      colorPermutation: colorPermutation,
      brightness: brightness
    };
  };
  
  exports.Effect = function (config, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    var programW = glw.compile(programDesc, resources, {
      PERMUTATION: config.colorPermutation || 0,
      BRIGHTNESS: config.brightness
    });
    
    // Figure needed point density
    // TODO: This actually depends on the FOV which is vertical only
    var viewport = gl.getParameter(gl.VIEWPORT);
    var viewportArea = viewport[2] * viewport[3];
    var pointsPerPixel = 1.5;
    var volume = viewportArea * pointsPerPixel;
    var radius = Math.floor(Math.pow(3 / (4 * Math.PI) * volume, 1/3));
    radius = Math.min(radius, 100);
    
    // Generate point buffer
    var side = radius*2+1;
    var count = side*side*side*3;
    var array = new Float32Array(count);
    var i = 0;
    for (var x = -radius; x <= radius; x++)
    for (var y = -radius; y <= radius; y++)
    for (var z = -radius; z <= radius; z++) {
      array[i++] = x / radius;
      array[i++] = y / radius;
      array[i++] = z / radius;
    }
    var grid = new glw.BufferAndArray([{
      attrib: glw.attribs.aVertexPosition,
      components: 3
    }]);
    grid.array = array;
    grid.send(gl.STATIC_DRAW);

    this.setState = function () {
      glw.useProgramW(programW);
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    };

    this.draw = function () {
      mat4.identity(mvMatrix);
      mat4.rotateX(mvMatrix, Date.now() / 1000 * 0.1);
      mat4.rotateY(mvMatrix, Date.now() / 1000 * 0.3);
      mat4.scale(mvMatrix, [3, 3, 3]);
      glw.setModelMatrix(mvMatrix);

      grid.attrib();
      grid.draw(gl.POINTS);
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      grid.deleteResources();
    };
  }
  exports.Effect.prototype.viewDistance = function () { return 0; };
  
}());
