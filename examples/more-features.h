struct Example1 {
  //@BE @LE
  uint8_t c;
  int v;
  unsigned long da;
} __attribute__((__packed__, aligned(4)));

//@BE
struct __attribute__((__packed__)) Example2 {
  /*some useful comment that should be skipped*/
  char name /*in-between comment*/ [16];
  int *p;
  uint32_t da[];
};
