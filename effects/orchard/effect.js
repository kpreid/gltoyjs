// Copyright 2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

"use strict";
(function () {
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.Effect = function (glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    var programW = glw.compile(programDesc, resources);
    
    var radius = 50;
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
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.enable(gl.DEPTH_TEST);
    };

    this.draw = function () {
      mat4.identity(mvMatrix);
      mat4.rotateX(mvMatrix, Date.now() / 1000 * 0.1);
      mat4.rotateY(mvMatrix, Date.now() / 1000 * 0.3);
      mat4.scale(mvMatrix, [3, 3, 3]);
      glw.modelview(mvMatrix);

      grid.attrib();
      grid.draw(gl.POINTS);
    };
  }
}());
