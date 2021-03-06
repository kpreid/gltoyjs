#ifdef GL_ES
precision highp float;
#endif

varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vPosition;

float lightDot(vec3 a, vec3 b) {
  // two-sided lighting
  return abs(dot(a, b));
}

void main(void) {
#if LIGHTING
  vec3 lightPos = vec3(0.0, 1.0, 3.0);
  vec3 lightDir = normalize(lightPos - vPosition);
  
  vec3 color = vec3(0.0);
  
  // ambient
  color += vec3(0.05);
  
  // diffuse
  color += vColor * vec3(1.0) * lightDot(lightDir, vNormal);
  
  // specular
  color += vec3(0.4) * pow(lightDot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 20.0);
  
#else
  vec3 color = vColor;
#endif
  gl_FragColor = vec4(color, 1.0);
}
