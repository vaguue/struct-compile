struct Inspect1 {
  bool b;
  long da;
};

struct Inspect2 {
  bool b;
  long da;
} __attribute__((packed));

struct Inspect3 {
  bool b;
  uint32_t kek;
} __attribute__((aligned(16)));

struct Inspect4 {
  /*some useful comment that should be skipped*/
  char name /*in-between comment*/ [16];
  int *p;
};

struct Inspect5 {
  int v;
  uint8_t c1;
  unsigned long da;
  uint8_t c2;
  int i[2], k;
  uint8_t c3;
} /*__attribute__((aligned(32)))*/;

struct pcap_file_header {
  uint32_t magic;
  uint16_t version_major;
  uint16_t version_minor;
  int32_t thiszone;
  uint32_t sigfigs;
  uint32_t snaplen;
  uint32_t linktype;
};

struct packet_header {
  uint32_t tv_sec;
  uint32_t tv_usec;
  uint32_t caplen;
  uint32_t len;
};

