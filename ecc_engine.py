import crcmod
import struct
from typing import Dict, Any, Tuple
from reedsolo import RSCodec, ReedSolomonError

class TraceMarkECC:
    """
    Handles structured binary payload creation, CRC32 integrity checks,
    and Reed-Solomon Error Correction Code (ECC) forward error correction.
    """
    
    HEADER = b"TM01"  # 4-byte protocol marker
    
    def __init__(self, ecc_symbols: int = 16):
        """
        :param ecc_symbols: Number of Reed-Solomon parity bytes.
                            Can correct up to (ecc_symbols // 2) byte errors.
        """
        self.ecc_symbols = ecc_symbols
        self.rs = RSCodec(ecc_symbols)
        self.crc32_func = crcmod.mkCrcFun(0x104C11DB7, initCrc=0xFFFFFFFF, rev=True, xorOut=0xFFFFFFFF)

    def pack_metadata(self, metadata: Dict[str, Any]) -> bytes:
        """
        Packs metadata dictionary into fixed-width binary format.
        Schema:
        - Exam ID:   ASCII (max 12 chars)
        - Press ID:  ASCII (max 8 chars)
        - Batch ID:  ASCII (max 8 chars)
        - Center ID: ASCII (max 8 chars)
        - Copy ID:   Unsigned 32-bit integer (4 bytes)
        """
        exam_id = metadata.get("exam_id", "UNKNOWN").encode('ascii')[:12].ljust(12, b'\x00')
        press_id = metadata.get("press_id", "PRS-00").encode('ascii')[:8].ljust(8, b'\x00')
        batch_id = metadata.get("batch_id", "B00").encode('ascii')[:8].ljust(8, b'\x00')
        center_id = metadata.get("center_id", "C00").encode('ascii')[:8].ljust(8, b'\x00')
        copy_id = int(metadata.get("copy_number", 0))

        raw_payload = struct.pack(
            ">4s12s8s8s8sI",
            self.HEADER,
            exam_id,
            press_id,
            batch_id,
            center_id,
            copy_id
        )
        
        # Append CRC32 checksum (4 bytes)
        crc32_val = self.crc32_func(raw_payload)
        payload_with_crc = raw_payload + struct.pack(">I", crc32_val)
        return payload_with_crc

    def unpack_metadata(self, raw_bytes: bytes) -> Dict[str, Any]:
        """
        Unpacks raw binary payload back into a metadata dictionary and verifies CRC32.
        """
        if len(raw_bytes) < 44:  # Header(4) + Exam(12) + Press(8) + Batch(8) + Center(8) + Copy(4) + CRC(4)
            raise ValueError("Payload buffer too short.")

        payload_part = raw_bytes[:-4]
        expected_crc = struct.unpack(">I", raw_bytes[-4:])[0]
        actual_crc = self.crc32_func(payload_part)

        if expected_crc != actual_crc:
            raise ValueError(f"CRC32 Checksum Mismatch! Expected {expected_crc}, got {actual_crc}")

        header, exam_id, press_id, batch_id, center_id, copy_id = struct.unpack(">4s12s8s8s8sI", payload_part)
        
        if header != self.HEADER:
            raise ValueError(f"Invalid Header Protocol Marker: {header}")

        return {
            "exam_id": exam_id.decode('ascii').rstrip('\x00'),
            "press_id": press_id.decode('ascii').rstrip('\x00'),
            "batch_id": batch_id.decode('ascii').rstrip('\x00'),
            "center_id": center_id.decode('ascii').rstrip('\x00'),
            "copy_number": copy_id
        }

    def encode_to_bitstream(self, metadata: Dict[str, Any]) -> str:
        """
        Encodes metadata -> binary -> CRC32 -> Reed-Solomon -> Bitstring ('0101...').
        """
        packed_bytes = self.pack_metadata(metadata)
        protected_bytes = bytes(self.rs.encode(packed_bytes))
        
        # Convert bytes to string of '0' and '1'
        bitstream = ''.join(f"{byte:08b}" for byte in protected_bytes)
        return bitstream

# ecc_engine.py (Inside decode_from_bitstream)
    def decode_from_bitstream(self, bitstream: str) -> Tuple[Dict[str, Any], int]:
        byte_chunks = [int(bitstream[i:i+8], 2) for i in range(0, len(bitstream) - len(bitstream) % 8, 8)]
        encoded_bytes = bytes(byte_chunks)
        
        # Reed-Solomon Decode & Correct
        decoded_bytes, _, err_pos = self.rs.decode(encoded_bytes)
        metadata = self.unpack_metadata(bytes(decoded_bytes))
        
        # Return length of err_pos bytearray as integer count
        return metadata, len(err_pos)