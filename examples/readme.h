struct Kek {
  uint8_t c;
  //@BE this value will be big-endian because of this comment
  int v;
  unsigned long da;
} __attribute__((__packed__, aligned(4)));

//@NE Network-endiannes for all members of this struct
struct __attribute__((__packed__)) Da {
  //Some useful comment
  char name /*in-between comment*/ [16];
  double dbl;
  int *p;
  uint32_t * da[];
};
