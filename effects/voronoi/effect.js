// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

"use strict";
(function () {
  function u() {
    return (Math.random() + Math.random() + Math.random() - 1.5)/2;
  }
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.Effect = function (glw, resources) {
    var gl = glw.context;
    var mvMatrix = mat4.create();
    
    var programW = glw.compile(programDesc, resources);
    
    var cverts = [0, 0, 0];
    for (var i = 0; i <= 50; i += 1) {
      var j = i * 2*Math.PI / 50;
      cverts.push(Math.sin(j), Math.cos(j), -1);
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

      for (var i = 0; i < 10; i++) {
        var x = Math.sin(2+i*10.2+now*1.1);
        var y = Math.sin(i*17+now);

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
  exports.Effect.prototype.viewDistance = function () { return 1; };
}());
