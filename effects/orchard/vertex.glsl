attribute vec3 aVertexPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform int uPermutation;

varying vec4 vColor;

void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  
  float dist = length(aVertexPosition);
  float distSqr = dist * dist * dist;
  
  vec3 colors = vec3(
    distSqr * float(BRIGHTNESS),
    float(BRIGHTNESS) * 0.5,
    (1.0 - distSqr) * float(BRIGHTNESS)
  );
  
#if PERMUTATION == 1
  colors = colors.rbg;
#elif PERMUTATION == 2
  colors = colors.grb;
#elif PERMUTATION == 3
  colors = colors.gbr;
#elif PERMUTATION == 4
  colors = colors.brg;
#elif PERMUTATION == 5
  colors = colors.bgr;
#endif
  
  vColor = vec4(colors.brg, 1.0);
}
