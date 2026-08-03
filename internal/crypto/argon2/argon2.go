// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license.
// This is the generic Argon2id subset of golang.org/x/crypto/argon2.
package argon2

import (
	"encoding/binary"
	"hash"
	"sync"

	"github.com/Luke-Lab666/LukePanel/internal/crypto/blake2b"
)

const Version = 0x13
const argon2id = 2
const blockLength = 128
const syncPoints = 4

type block [blockLength]uint64

// IDKey derives a key using Argon2id. Memory is measured in KiB.
func IDKey(password, salt []byte, time, memory uint32, threads uint8, keyLen uint32) []byte {
	if time < 1 {
		panic("argon2: number of rounds too small")
	}
	if threads < 1 {
		panic("argon2: parallelism degree too low")
	}
	h0 := initHash(password, salt, nil, nil, time, memory, uint32(threads), keyLen, argon2id)
	memory = memory / (syncPoints * uint32(threads)) * (syncPoints * uint32(threads))
	if memory < 2*syncPoints*uint32(threads) {
		memory = 2 * syncPoints * uint32(threads)
	}
	B := initBlocks(&h0, memory, uint32(threads))
	processBlocks(B, time, memory, uint32(threads), argon2id)
	return extractKey(B, memory, uint32(threads), keyLen)
}

func initHash(password, salt, key, data []byte, time, memory, threads, keyLen uint32, mode int) [blake2b.Size + 8]byte {
	var h0 [blake2b.Size + 8]byte
	var params [24]byte
	var tmp [4]byte
	b2, _ := blake2b.New512(nil)
	binary.LittleEndian.PutUint32(params[0:4], threads)
	binary.LittleEndian.PutUint32(params[4:8], keyLen)
	binary.LittleEndian.PutUint32(params[8:12], memory)
	binary.LittleEndian.PutUint32(params[12:16], time)
	binary.LittleEndian.PutUint32(params[16:20], uint32(Version))
	binary.LittleEndian.PutUint32(params[20:24], uint32(mode))
	_, _ = b2.Write(params[:])
	binary.LittleEndian.PutUint32(tmp[:], uint32(len(password)))
	_, _ = b2.Write(tmp[:])
	_, _ = b2.Write(password)
	binary.LittleEndian.PutUint32(tmp[:], uint32(len(salt)))
	_, _ = b2.Write(tmp[:])
	_, _ = b2.Write(salt)
	binary.LittleEndian.PutUint32(tmp[:], uint32(len(key)))
	_, _ = b2.Write(tmp[:])
	_, _ = b2.Write(key)
	binary.LittleEndian.PutUint32(tmp[:], uint32(len(data)))
	_, _ = b2.Write(tmp[:])
	_, _ = b2.Write(data)
	b2.Sum(h0[:0])
	return h0
}

func initBlocks(h0 *[blake2b.Size + 8]byte, memory, threads uint32) []block {
	var block0 [1024]byte
	B := make([]block, memory)
	for lane := uint32(0); lane < threads; lane++ {
		j := lane * (memory / threads)
		binary.LittleEndian.PutUint32(h0[blake2b.Size+4:], lane)
		binary.LittleEndian.PutUint32(h0[blake2b.Size:], 0)
		blake2bHash(block0[:], h0[:])
		for i := range B[j] {
			B[j][i] = binary.LittleEndian.Uint64(block0[i*8:])
		}
		binary.LittleEndian.PutUint32(h0[blake2b.Size:], 1)
		blake2bHash(block0[:], h0[:])
		for i := range B[j+1] {
			B[j+1][i] = binary.LittleEndian.Uint64(block0[i*8:])
		}
	}
	return B
}

func processBlocks(B []block, time, memory, threads uint32, mode int) {
	lanes := memory / threads
	segments := lanes / syncPoints
	processSegment := func(n, slice, lane uint32, wg *sync.WaitGroup) {
		defer wg.Done()
		var addresses, in, zero block
		if mode == argon2id && n == 0 && slice < syncPoints/2 {
			in[0] = uint64(n)
			in[1] = uint64(lane)
			in[2] = uint64(slice)
			in[3] = uint64(memory)
			in[4] = uint64(time)
			in[5] = uint64(mode)
		}
		index := uint32(0)
		if n == 0 && slice == 0 {
			index = 2
			in[6]++
			processBlock(&addresses, &in, &zero)
			processBlock(&addresses, &addresses, &zero)
		}
		offset := lane*lanes + slice*segments + index
		var random uint64
		for index < segments {
			prev := offset - 1
			if index == 0 && slice == 0 {
				prev += lanes
			}
			if n == 0 && slice < syncPoints/2 {
				if index%blockLength == 0 {
					in[6]++
					processBlock(&addresses, &in, &zero)
					processBlock(&addresses, &addresses, &zero)
				}
				random = addresses[index%blockLength]
			} else {
				random = B[prev][0]
			}
			newOffset := indexAlpha(random, lanes, segments, threads, n, slice, lane, index)
			processBlockXOR(&B[offset], &B[prev], &B[newOffset])
			index, offset = index+1, offset+1
		}
	}
	for n := uint32(0); n < time; n++ {
		for slice := uint32(0); slice < syncPoints; slice++ {
			var wg sync.WaitGroup
			for lane := uint32(0); lane < threads; lane++ {
				wg.Add(1)
				go processSegment(n, slice, lane, &wg)
			}
			wg.Wait()
		}
	}
}

func extractKey(B []block, memory, threads, keyLen uint32) []byte {
	lanes := memory / threads
	for lane := uint32(0); lane < threads-1; lane++ {
		for i, value := range B[(lane*lanes)+lanes-1] {
			B[memory-1][i] ^= value
		}
	}
	var raw [1024]byte
	for i, value := range B[memory-1] {
		binary.LittleEndian.PutUint64(raw[i*8:], value)
	}
	key := make([]byte, keyLen)
	blake2bHash(key, raw[:])
	return key
}

func indexAlpha(random uint64, lanes, segments, threads, n, slice, lane, index uint32) uint32 {
	refLane := uint32(random>>32) % threads
	if n == 0 && slice == 0 {
		refLane = lane
	}
	m, start := 3*segments, ((slice+1)%syncPoints)*segments
	if lane == refLane {
		m += index
	}
	if n == 0 {
		m, start = slice*segments, 0
		if slice == 0 || lane == refLane {
			m += index
		}
	}
	if index == 0 || lane == refLane {
		m--
	}
	return phi(random, uint64(m), uint64(start), refLane, lanes)
}

func phi(random, m, start uint64, lane, lanes uint32) uint32 {
	p := random & 0xffffffff
	p = (p * p) >> 32
	p = (p * m) >> 32
	return lane*lanes + uint32((start+m-(p+1))%uint64(lanes))
}

func blake2bHash(out, in []byte) {
	var b2 hash.Hash
	if len(out) < blake2b.Size {
		b2, _ = blake2b.New(len(out), nil)
	} else {
		b2, _ = blake2b.New512(nil)
	}
	var buffer [blake2b.Size]byte
	binary.LittleEndian.PutUint32(buffer[:4], uint32(len(out)))
	_, _ = b2.Write(buffer[:4])
	_, _ = b2.Write(in)
	if len(out) <= blake2b.Size {
		b2.Sum(out[:0])
		return
	}
	outLen := len(out)
	b2.Sum(buffer[:0])
	b2.Reset()
	copy(out, buffer[:32])
	out = out[32:]
	for len(out) > blake2b.Size {
		_, _ = b2.Write(buffer[:])
		b2.Sum(buffer[:0])
		copy(out, buffer[:32])
		out = out[32:]
		b2.Reset()
	}
	if outLen%blake2b.Size > 0 {
		rounds := ((outLen + 31) / 32) - 2
		b2, _ = blake2b.New(outLen-32*rounds, nil)
	}
	_, _ = b2.Write(buffer[:])
	b2.Sum(out[:0])
}

func processBlock(out, in1, in2 *block)    { processBlockGeneric(out, in1, in2, false) }
func processBlockXOR(out, in1, in2 *block) { processBlockGeneric(out, in1, in2, true) }

func processBlockGeneric(out, in1, in2 *block, xor bool) {
	var t block
	for i := range t {
		t[i] = in1[i] ^ in2[i]
	}
	for i := 0; i < blockLength; i += 16 {
		blamka(&t[i], &t[i+1], &t[i+2], &t[i+3], &t[i+4], &t[i+5], &t[i+6], &t[i+7], &t[i+8], &t[i+9], &t[i+10], &t[i+11], &t[i+12], &t[i+13], &t[i+14], &t[i+15])
	}
	for i := 0; i < blockLength/8; i += 2 {
		blamka(&t[i], &t[i+1], &t[16+i], &t[17+i], &t[32+i], &t[33+i], &t[48+i], &t[49+i], &t[64+i], &t[65+i], &t[80+i], &t[81+i], &t[96+i], &t[97+i], &t[112+i], &t[113+i])
	}
	if xor {
		for i := range t {
			out[i] ^= in1[i] ^ in2[i] ^ t[i]
		}
	} else {
		for i := range t {
			out[i] = in1[i] ^ in2[i] ^ t[i]
		}
	}
}

func blamka(v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14, v15 *uint64) {
	a0, a1, a2, a3 := *v0, *v1, *v2, *v3
	a4, a5, a6, a7 := *v4, *v5, *v6, *v7
	a8, a9, a10, a11 := *v8, *v9, *v10, *v11
	a12, a13, a14, a15 := *v12, *v13, *v14, *v15
	g := func(a, b, c, d *uint64) {
		*a += *b + 2*uint64(uint32(*a))*uint64(uint32(*b))
		*d ^= *a
		*d = *d>>32 | *d<<32
		*c += *d + 2*uint64(uint32(*c))*uint64(uint32(*d))
		*b ^= *c
		*b = *b>>24 | *b<<40
		*a += *b + 2*uint64(uint32(*a))*uint64(uint32(*b))
		*d ^= *a
		*d = *d>>16 | *d<<48
		*c += *d + 2*uint64(uint32(*c))*uint64(uint32(*d))
		*b ^= *c
		*b = *b>>63 | *b<<1
	}
	g(&a0, &a4, &a8, &a12)
	g(&a1, &a5, &a9, &a13)
	g(&a2, &a6, &a10, &a14)
	g(&a3, &a7, &a11, &a15)
	g(&a0, &a5, &a10, &a15)
	g(&a1, &a6, &a11, &a12)
	g(&a2, &a7, &a8, &a13)
	g(&a3, &a4, &a9, &a14)
	*v0, *v1, *v2, *v3 = a0, a1, a2, a3
	*v4, *v5, *v6, *v7 = a4, a5, a6, a7
	*v8, *v9, *v10, *v11 = a8, a9, a10, a11
	*v12, *v13, *v14, *v15 = a12, a13, a14, a15
}
