struct Example1 {
  uint8_t c;
  //@BE
  int v;
  unsigned long da;
} __attribute__((__packed__, aligned(4)));

//@NE
struct __attribute__((__packed__)) Example2 {
  /*some useful comment that should be skipped*/
  char name /*in-between comment*/ [16];
  double dbl;
  int *p;
  uint32_t * da[];
};
