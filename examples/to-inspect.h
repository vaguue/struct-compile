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

struct Inspect6 {
  uint8_t c1;
  uint8_t c2;
  uint8_t c3;
  uint8_t c4;
  uint8_t c5;
  uint8_t c6;
  uint8_t c7;
  uint8_t c8 __attribute__((aligned(16)));
  uint16_t i1;
  uint8_t c9;
  uint8_t c10;
  uint8_t c11;
} __attribute__((packed));

struct Inspect7 {
  uint32_t i;
  char* p;
};

struct BitFields {
  uint8_t 
   c1: 1,
   c2: 2,
   c3: 3,
   x,
   c4: 4,
   c5: 5,
   c6: 6,
   c7: 7,
   c8: 8;
};


typedef struct { char c; short x; } st_short;
typedef struct { char c; int x; } st_int;
typedef struct { char c; long x; } st_long;
typedef struct { char c; float x; } st_float;
typedef struct { char c; double x; } st_double;
typedef struct { char c; void *x; } st_void_p;
typedef struct { char c; size_t x; } st_size_t;
typedef struct { char c; _Bool x; } st_bool;

#define SHORT_ALIGN (sizeof(st_short) - sizeof(short))
#define INT_ALIGN (sizeof(st_int) - sizeof(int))
#define LONG_ALIGN (sizeof(st_long) - sizeof(long))
#define FLOAT_ALIGN (sizeof(st_float) - sizeof(float))
#define DOUBLE_ALIGN (sizeof(st_double) - sizeof(double))
#define VOID_P_ALIGN (sizeof(st_void_p) - sizeof(void *))
#define SIZE_T_ALIGN (sizeof(st_size_t) - sizeof(size_t))
#define BOOL_ALIGN (sizeof(st_bool) - sizeof(_Bool))
