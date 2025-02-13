/* SPDX-License-Identifier: GPL-2.0 */

/*
 * Userspace port (c) 2019 Hak5 LLC
 */

#ifndef _USERSPACE_LINUX_UNALIGNED_LE_BYTESHIFT_H
#define _USERSPACE_LINUX_UNALIGNED_LE_BYTESHIFT_H

#include "kernel/types.h"

static inline uint16_t __get_unaligned_le16(const uint8_t *p)
{
	return p[0] | p[1] << 8;
}

static inline uint32_t __get_unaligned_le32(const uint8_t *p)
{
	return p[0] | p[1] << 8 | p[2] << 16 | p[3] << 24;
}

static inline u64 __get_unaligned_le64(const uint8_t *p)
{
	return (u64)__get_unaligned_le32(p + 4) << 32 |
	       __get_unaligned_le32(p);
}

static inline void __put_unaligned_le16(uint16_t val, uint8_t *p)
{
	*p++ = val;
	*p++ = val >> 8;
}

static inline void __put_unaligned_le32(uint32_t val, uint8_t *p)
{
	__put_unaligned_le16(val >> 16, p + 2);
	__put_unaligned_le16(val, p);
}

static inline void __put_unaligned_le64(u64 val, uint8_t *p)
{
	__put_unaligned_le32(val >> 32, p + 4);
	__put_unaligned_le32(val, p);
}

static inline uint16_t get_unaligned_le16(const void *p)
{
	return __get_unaligned_le16((const uint8_t *)p);
}

static inline uint32_t get_unaligned_le32(const void *p)
{
	return __get_unaligned_le32((const uint8_t *)p);
}

static inline u64 get_unaligned_le64(const void *p)
{
	return __get_unaligned_le64((const uint8_t *)p);
}

static inline void put_unaligned_le16(uint16_t val, void *p)
{
	__put_unaligned_le16(val, (uint8_t *) p);
}

static inline void put_unaligned_le32(uint32_t val, void *p)
{
	__put_unaligned_le32(val, (uint8_t *) p);
}

static inline void put_unaligned_le64(u64 val, void *p)
{
	__put_unaligned_le64(val, (uint8_t *) p);
}

#endif /* _USERSPACE_LINUX_UNALIGNED_LE_BYTESHIFT_H */
