#include "stdbool.h"
#include "stdint.h"
#include "stdio.h"
#include "basic.h"
#include "more-features.h"
#include "to-inspect.h"

#define INSPECT_SIZE(x) printf(#x" size: %lu\n", sizeof(x))
#define PRINT(x) printf(#x" : %lu\n", (x))

int main() {
  char* var[24];
  int nums[2][2][2];
  uint32_t** da;
  char name[24];
  INSPECT_SIZE(struct Basic);
  INSPECT_SIZE(struct Example1);
  INSPECT_SIZE(struct Example2);
  INSPECT_SIZE(struct Example3);

  puts("\n============\n");

  struct Inspect6 inspect6Obj;
  INSPECT_SIZE(struct Inspect6);
  printf("c1: %lu %lu\n", (void*)&inspect6Obj.c1 - (void*)&inspect6Obj, sizeof(inspect6Obj.c1));
  printf("c2: %lu %lu\n", (void*)&inspect6Obj.c2 - (void*)&inspect6Obj, sizeof(inspect6Obj.c2));
  printf("c3: %lu %lu\n", (void*)&inspect6Obj.c3 - (void*)&inspect6Obj, sizeof(inspect6Obj.c3));
  printf("c4: %lu %lu\n", (void*)&inspect6Obj.c4 - (void*)&inspect6Obj, sizeof(inspect6Obj.c4));
  printf("c5: %lu %lu\n", (void*)&inspect6Obj.c5 - (void*)&inspect6Obj, sizeof(inspect6Obj.c5));
  printf("c6: %lu %lu\n", (void*)&inspect6Obj.c6 - (void*)&inspect6Obj, sizeof(inspect6Obj.c6));
  printf("c7: %lu %lu\n", (void*)&inspect6Obj.c7 - (void*)&inspect6Obj, sizeof(inspect6Obj.c7));
  printf("c8: %lu %lu\n", (void*)&inspect6Obj.c8 - (void*)&inspect6Obj, sizeof(inspect6Obj.c8));
  printf("i1: %lu %lu\n", (void*)&inspect6Obj.i1 - (void*)&inspect6Obj, sizeof(inspect6Obj.i1));
  printf("c9: %lu %lu\n", (void*)&inspect6Obj.c9 - (void*)&inspect6Obj, sizeof(inspect6Obj.c9));
  printf("c10: %lu %lu\n", (void*)&inspect6Obj.c10 - (void*)&inspect6Obj, sizeof(inspect6Obj.c10));

  puts("\n============\n");

  INSPECT_SIZE(int);
  INSPECT_SIZE(unsigned long);
  INSPECT_SIZE(int*);
  INSPECT_SIZE(var);
  INSPECT_SIZE(name);
  INSPECT_SIZE(nums);

  puts("\n============\n");

  INSPECT_SIZE(struct Inspect1);
  INSPECT_SIZE(struct Inspect2);
  INSPECT_SIZE(struct Inspect3);
  INSPECT_SIZE(struct Inspect4);

  puts("\n============\n");

  struct Inspect5 obj = { 0 };
  printf("v: %lu %lu\n", (void*)&obj.v - (void*)&obj, sizeof(obj.v));
  printf("c1: %lu %lu\n", (void*)&obj.c1 - (void*)&obj, sizeof(obj.c1));
  printf("da: %lu %lu\n", (void*)&obj.da - (void*)&obj, sizeof(obj.da));
  printf("c2: %lu %lu\n", (void*)&obj.c2 - (void*)&obj, sizeof(obj.c2));
  printf("i: %lu %lu\n", (void*)&obj.i - (void*)&obj, sizeof(obj.i));
  printf("k: %lu %lu\n", (void*)&obj.k - (void*)&obj, sizeof(obj.k));
  INSPECT_SIZE(struct Inspect5);

  INSPECT_SIZE(struct pcap_file_header);
  INSPECT_SIZE(struct packet_header);


  PRINT(SHORT_ALIGN);
  PRINT(INT_ALIGN);
  PRINT(LONG_ALIGN);
  PRINT(FLOAT_ALIGN);
  PRINT(DOUBLE_ALIGN);
  PRINT(VOID_P_ALIGN);
  PRINT(SIZE_T_ALIGN);
  PRINT(BOOL_ALIGN);

  INSPECT_SIZE(struct BitFields);

  return 0;
}
