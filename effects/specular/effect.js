// Copyright 2011-2012 Kevin Reid under the terms of the MIT License as detailed
// in the accompanying file README.md or <http://opensource.org/licenses/MIT>.

// TODO: Add in all the features and characteristics from the original GLToy version.

(function () {
  "use strict";
  
  var abs = Math.abs;
  var cos = Math.cos;
  var PI = Math.PI;
  var randBool = gltoy.randBool;
  var randElem = gltoy.randElem;
  var randInt = gltoy.randInt;
  var random = Math.random;
  var sin = Math.sin;
  
  var TWOPI = PI * 2;
  
  var programDesc = {
    vertex: ["vertex.glsl"],
    fragment: ["fragment.glsl"]
  };
  
  exports.shaders = programDesc;
  
  exports.configure = function () {
    var parameters = {
      // TODO better parameter names
      tumbler: gltoy.Tumbler.configure(),
      blend: randBool(),
      separate: randBool(),
      torusMask: 1 + randInt((1 << 3) - 1),
      nTorus: 2 + randInt(8),
      nLights: 1 + randInt(7),
      tStep: 0.1 + random() * 0.2,
      shininess: random() * 20 + 10
    };
    parameters.tRadius = randBool() ? parameters.tStep / 2 : random() * 0.14 + 0.01;
    return parameters;
  };
  
  exports.Effect = function (parameters, glw, resources) {
    var gl = glw.context;
    var programW = glw.compile(programDesc, resources, {
      SHININESS: parameters.shininess,
      NLIGHTS: parameters.nLights
    });
    var baseMatrix = mat4.create();
    var modelMatrix = mat4.create();
    var tumbler = new gltoy.Tumbler(parameters.tumbler);
    
    function makeTorus(r1, r2) {
      var tiles1 = 48, tiles2 = 48;
      var verts = [];
      for (var i1 = 0; i1 < tiles1; i1++) {
        var a1a = i1 / tiles1 * TWOPI;
        var a1b = (i1+1) / tiles1 * TWOPI;
        var sin1a = sin(a1a);
        var cos1a = cos(a1a);
        var sin1b = sin(a1b);
        var cos1b = cos(a1b);
        for (var i2 = 0; i2 <= tiles2; i2++) {
          var a2 = i2 / tiles2 * TWOPI;
          var sin2 = sin(a2);
          var cos2 = cos(a2);
          verts.push(
            // position
            sin1a * (r1 + sin2 * r2),
            cos1a * (r1 + sin2 * r2),
            cos2 * r2,
            // normal
            sin2 * sin1a,
            sin2 * cos1a,
            cos2,
            
            // position
            sin1b * (r1 + sin2 * r2),
            cos1b * (r1 + sin2 * r2),
            cos2 * r2,
            // normal
            sin2 * sin1b,
            sin2 * cos1b,
            cos2
          );
        }
      }
      var torus = new glw.BufferAndArray([
        {
          attrib: programW.attribs.aPosition,
          components: 3
        },
        {
          attrib: programW.attribs.aNormal,
          components: 3
        }
      ]);
      torus.load(verts);
      torus.send(gl.STATIC_DRAW);
      return torus;
    }
    
    var nLights = parameters.nLights;
    var nTorus = parameters.nTorus;
    var separate = parameters.separate;
    var torusMask = parameters.torusMask;
    
    var tori = [];
    for (var i = 0; i < nTorus; i++) {
      tori[i] = makeTorus(parameters.tStep * i, parameters.tRadius);
    }
    
    this.setState = function () {
      glw.useProgramW(programW);
      
      gl.enable(gl.CULL_FACE);
      if (parameters.blend) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.disable(gl.DEPTH_TEST);
      } else {
        gl.enable(gl.DEPTH_TEST);
      }
    };
    
    this.draw = function () {
      var now = new Date().getTime() / 1000;
      
      mat4.identity(baseMatrix);
      tumbler.apply(baseMatrix, now);
      
      var dirvec = vec3.create();
      var lightDir = new Float32Array(3 * nLights);
      var lightColor = new Float32Array(3 * nLights);
      for (i = 0; i < nLights; i++) {
        dirvec[0] = sin(now/(i+13));
        dirvec[1] = sin(now/(i+14));
        dirvec[2] = abs(sin(now/(i+15))); // front-side only
        vec3.normalize(dirvec);
        lightDir[i*3+0] = dirvec[0];
        lightDir[i*3+1] = dirvec[1];
        lightDir[i*3+2] = dirvec[2];
        
        lightColor[i*3+0] = sin(now/(i+10)) * 0.5 + 0.5;
        lightColor[i*3+1] = sin(now/(i+11)) * 0.5 + 0.5;
        lightColor[i*3+2] = sin(now/(i+12)) * 0.5 + 0.5;
      }
      gl.uniform3fv(glw.uniforms.uLightDir, lightDir);
      gl.uniform3fv(glw.uniforms.uLightColor, lightColor);
      
      for (var i = 0; i < nTorus; i++) {
        tori[i].attrib();
        gl.uniform3f(glw.uniforms.uColor, i/nTorus, 0, 1);
        
        mat4.set(baseMatrix, modelMatrix);
        if (separate)
          mat4.translate(modelMatrix, [sin(now / 5 + i * (TWOPI/nTorus)), 0, 0]);
        
        mat4.rotateY(modelMatrix, now * .017 * (50 + i *  10));
        glw.setModelMatrix(modelMatrix);
        if (torusMask & (1 << 0)) tori[i].draw(gl.TRIANGLE_STRIP);
        
        mat4.rotateX(modelMatrix, now * .017 * (40 + i *  10));
        glw.setModelMatrix(modelMatrix);
        if (torusMask & (1 << 1)) tori[i].draw(gl.TRIANGLE_STRIP);
        
        mat4.rotateY(modelMatrix, now * .017 * (30 + i *  10));
        glw.setModelMatrix(modelMatrix);
        if (torusMask & (1 << 2)) tori[i].draw(gl.TRIANGLE_STRIP);
      }
    };
    
    this.deleteResources = function () {
      programW.deleteResources();
      tori.forEach(function (torus) { torus.deleteResources(); });
    }
  }
  exports.Effect.prototype.viewDistance = function () { return 20; };
  exports.Effect.prototype.viewRadius = function () { return 1; };
  exports.Effect.prototype.nearClipFraction = function () { return 0.1; };
  exports.Effect.prototype.farClipDistance = function () { return 2; };
}());
