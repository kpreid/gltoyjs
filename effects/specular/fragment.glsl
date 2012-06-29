#ifdef GL_ES
precision highp float;
#endif

uniform vec3 uLightDir[NLIGHTS];
uniform vec3 uLightColor[NLIGHTS];

varying vec3 vNormal;
varying vec3 vColor;

void main(void) {
  vec3 color = vec3(0.0);
  for (int i = 0; i < NLIGHTS; i++) {
    color += uLightColor[i] * pow(max(0.0, dot(vNormal, uLightDir[i])), float(SHININESS));
  }
  //color += vColor * pow(max(0.0, dot(vNormal, vec3(0.0, 1.0, 0.0))), float(SHININESS));
  gl_FragColor = vec4(color, 1.0);
}
