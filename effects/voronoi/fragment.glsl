#ifdef GL_ES
precision highp float;
#endif

varying vec4 vColor;
varying vec4 vP;

void main(void) {
  vec3 np = vec3(vP)/vP.w;
  float k;
  k = min(1.0, max(0.0, 7.0 - length(vec2(np))/0.25));
  gl_FragColor = vec4(vColor.r*k, vColor.g*k, vColor.b*k, 1.0);
}
