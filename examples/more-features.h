struct Example1 {
  uint8_t c;
  //@BE this value will be big-endian
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

struct Example3 {
  uint8_t c;
  double m[16][16];
};

struct Example4 {
  uint8_t version:4,
          headerLength:4;

  uint8_t typeOfService;
} __attribute__((packed));
