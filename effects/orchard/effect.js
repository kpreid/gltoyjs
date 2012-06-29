// Copyright 2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

(function () {
  "use strict";

  var randInt = gltoy.randInt;
  var random = Math.random;
  var sqrt = Math.sqrt;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var colorPermutation = randInt(6);
    var brightness = 0.06 + random() * 0.74;
    
    return {
      tumbler: gltoy.Tumbler.configure(),
      colorPermutation: colorPermutation,
      brightness: brightness
    };
  };
  
  var SCALE = 2;
  
  exports.Effect = function (param, glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    var programW = glw.compile(programDesc, resources, {
      PERMUTATION: param.colorPermutation || 0,
      BRIGHTNESS: param.brightness
    });
    var tumbler = new gltoy.Tumbler(param.tumbler);
    
    // Figure needed point density
    // TODO: This actually depends on the FOV as well
    // TODO update when viewport / aspect ratio changes
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
      array[i++] = x / radius * SCALE;
      array[i++] = y / radius * SCALE;
      array[i++] = z / radius * SCALE;
    }
    var grid = new glw.BufferAndArray([{
      attrib: programW.attribs.aVertexPosition,
      components: 3
    }]);
    grid.array = array;
    grid.send(gl.STATIC_DRAW);

    this.setState = function () {
      glw.useProgramW(programW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    };

    this.draw = function (frame) {
      mat4.identity(mvMatrix);
      tumbler.apply(mvMatrix, frame.t);
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
  exports.Effect.prototype.fovTangent = function () { return 1; };
  exports.Effect.prototype.nearClipDistance = function () { return SCALE * 0.001; };
  exports.Effect.prototype.farClipDistance = function () { return SCALE * 2; };
  
}());
