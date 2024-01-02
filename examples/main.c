#include "stdbool.h"
#include "stdint.h"
#include "stdio.h"
#include "basic.h"
#include "more-features.h"
#include "to-inspect.h"

#define INSPECT_SIZE(x) printf(#x": %lu\n", sizeof(x))

int main() {
  char* var[24];
  int nums[2][2][2];
  uint32_t** da;
  char name[24];
  INSPECT_SIZE(struct Basic);
  INSPECT_SIZE(struct Example1);
  INSPECT_SIZE(struct Example2);

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

  return 0;
}
