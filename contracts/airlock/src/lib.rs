//! Airlock withdrawal firewall for Portaldot's legacy seal0 ABI.
//! Dependency-free, bounded storage records, fixed-width ABI in docs/ABI.md.
#![no_std]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}

#[link(wasm_import_module = "seal0")]
extern "C" {
    fn seal_input(out: *mut u8, len: *mut u32);
    fn seal_return(flags: u32, data: *const u8, len: u32) -> !;
    fn seal_caller(out: *mut u8, len: *mut u32);
    fn seal_now(out: *mut u8, len: *mut u32);
    fn seal_balance(out: *mut u8, len: *mut u32);
    fn seal_set_storage(key: *const u8, data: *const u8, len: u32);
    fn seal_get_storage(key: *const u8, out: *mut u8, len: *mut u32) -> u32;
    fn seal_hash_blake2_256(data: *const u8, len: u32, out: *mut u8);
    fn seal_transfer(account: *const u8, account_len: u32, value: *const u8, value_len: u32)
        -> u32;
    fn seal_deposit_event(topics: *const u8, topics_len: u32, data: *const u8, data_len: u32);
}

const CFG: [u8; 32] = [1; 32];
const WINDOW: [u8; 32] = [2; 32];
const RESERVED: [u8; 32] = [3; 32];
const PAUSE: [u8; 32] = [4; 32];
const PLAN: [u8; 32] = [5; 32];
// Config: relay32 guardian32 domain32 instant16 cap16 delay8 window8
// policyDelay8 reserveFloor16 maxPending16 = 184 bytes.
const CFG_LEN: usize = 184;
// Codes are stable and decoded by the client. Nonzero outcomes revert.
fn fail(code: u8) -> ! {
    unsafe { seal_return(1, [code].as_ptr(), 1) }
}
fn ret(data: &[u8]) -> ! {
    unsafe { seal_return(0, data.as_ptr(), data.len() as u32) }
}
fn save(key: &[u8; 32], data: &[u8]) {
    unsafe { seal_set_storage(key.as_ptr(), data.as_ptr(), data.len() as u32) }
}
fn read<const N: usize>(key: &[u8; 32]) -> Option<[u8; N]> {
    let mut b = [0; N];
    let mut len = N as u32;
    let rc = unsafe { seal_get_storage(key.as_ptr(), b.as_mut_ptr(), &mut len) };
    if rc == 0 && len == N as u32 {
        Some(b)
    } else {
        None
    }
}
fn u128at(b: &[u8], p: usize) -> u128 {
    let mut a = [0; 16];
    a.copy_from_slice(&b[p..p + 16]);
    u128::from_le_bytes(a)
}
fn u64at(b: &[u8], p: usize) -> u64 {
    let mut a = [0; 8];
    a.copy_from_slice(&b[p..p + 8]);
    u64::from_le_bytes(a)
}
fn caller() -> [u8; 32] {
    let mut b = [0; 32];
    let mut n = 32;
    unsafe { seal_caller(b.as_mut_ptr(), &mut n) };
    if n != 32 {
        fail(1)
    };
    b
}
fn now() -> u64 {
    let mut b = [0; 8];
    let mut n = 8;
    unsafe { seal_now(b.as_mut_ptr(), &mut n) };
    u64::from_le_bytes(b)
}
fn balance() -> u128 {
    let mut b = [0; 16];
    let mut n = 16;
    unsafe { seal_balance(b.as_mut_ptr(), &mut n) };
    u128::from_le_bytes(b)
}
fn config() -> [u8; CFG_LEN] {
    read(&CFG).unwrap_or_else(|| fail(2))
}
fn guardian(c: &[u8]) {
    if caller() != c[32..64] {
        fail(3)
    }
}
fn reserved() -> u128 {
    read::<16>(&RESERVED).map(u128::from_le_bytes).unwrap_or(0)
}
fn paused() -> bool {
    read::<1>(&PAUSE).unwrap_or([0])[0] != 0
}
fn add(a: u128, b: u128) -> u128 {
    a.checked_add(b).unwrap_or_else(|| fail(4))
}
fn due(t: u64, d: u64) -> u64 {
    t.checked_add(d).unwrap_or_else(|| fail(4))
}
fn key(domain: &[u8], nonce: &[u8]) -> [u8; 32] {
    let mut data = [0; 41];
    data[0] = 77;
    data[1..33].copy_from_slice(domain);
    data[33..].copy_from_slice(nonce);
    let mut k = [0; 32];
    unsafe { seal_hash_blake2_256(data.as_ptr(), 41, k.as_mut_ptr()) };
    k
}
// Message record: status1 recipient32 amount16 eligible8 created8 = 65 bytes.
fn emit(kind: u8, k: &[u8; 32], amount: u128) {
    let mut e = [0; 49];
    e[0] = kind;
    e[1..33].copy_from_slice(k);
    e[33..].copy_from_slice(&amount.to_le_bytes());
    unsafe { seal_deposit_event(core::ptr::null(), 0, e.as_ptr(), 49) }
}
fn valid(c: &[u8]) {
    if c[0..32] == c[32..64] || c[0..32] == [0; 32] || c[32..64] == [0; 32] {
        fail(5)
    }
    if u128at(c, 96) == 0
        || u128at(c, 112) < u128at(c, 96)
        || u64at(c, 128) == 0
        || u64at(c, 136) == 0
        || u64at(c, 144) == 0
        || u128at(c, 168) == 0
    {
        fail(5)
    }
}
fn window(c: &[u8], t: u64) -> (u64, u128) {
    let id = t / u64at(c, 136);
    match read::<24>(&WINDOW) {
        Some(w) if u64at(&w, 0) == id => (id, u128at(&w, 8)),
        _ => (id, 0),
    }
}
fn spend(c: &[u8], t: u64, amount: u128) {
    let (id, spent) = window(c, t);
    let total = add(spent, amount);
    if total > u128at(c, 112) {
        fail(6)
    }
    let mut w = [0; 24];
    w[..8].copy_from_slice(&id.to_le_bytes());
    w[8..].copy_from_slice(&total.to_le_bytes());
    save(&WINDOW, &w);
}
fn transfer(to: &[u8], amount: u128) {
    let rc = unsafe { seal_transfer(to.as_ptr(), 32, amount.to_le_bytes().as_ptr(), 16) };
    if rc != 0 {
        fail(7)
    }
}

#[no_mangle]
pub extern "C" fn deploy() {
    let mut input = [0; CFG_LEN];
    let mut len = CFG_LEN as u32;
    unsafe { seal_input(input.as_mut_ptr(), &mut len) };
    if len != CFG_LEN as u32 {
        fail(1)
    };
    valid(&input);
    if balance() < u128at(&input, 152) {
        fail(8)
    }
    save(&CFG, &input);
    save(&PAUSE, &[0]);
    save(&RESERVED, &0u128.to_le_bytes());
    ret(&[0]);
}

#[no_mangle]
pub extern "C" fn call() {
    let mut b = [0; 256];
    let mut len = 256;
    unsafe { seal_input(b.as_mut_ptr(), &mut len) };
    if len == 0 {
        fail(1)
    };
    let c = config();
    let t = now();
    match b[0] {
        // State: config184 paused1 reserved16 windowSpent16 balance16 now8 planPresent1 plan73.
        0 => {
            if len != 1 {
                fail(1)
            };
            let mut out = [0; 315];
            out[..184].copy_from_slice(&c);
            out[184] = paused() as u8;
            out[185..201].copy_from_slice(&reserved().to_le_bytes());
            out[201..217].copy_from_slice(&window(&c, t).1.to_le_bytes());
            out[217..233].copy_from_slice(&balance().to_le_bytes());
            out[233..241].copy_from_slice(&t.to_le_bytes());
            if let Some(p) = read::<73>(&PLAN) {
                if p[72] == 1 {
                    out[241] = 1;
                    out[242..315].copy_from_slice(&p)
                }
            };
            ret(&out)
        }
        // Submit: domain32 nonce8 recipient32 amount16 = 89 including selector.
        1 => {
            if len != 89 {
                fail(1)
            };
            if caller() != c[..32] {
                fail(9)
            };
            if paused() {
                fail(10)
            };
            if b[1..33] != c[64..96] {
                fail(11)
            }
            let k = key(&b[1..33], &b[33..41]);
            if read::<65>(&k).is_some() {
                fail(12)
            }
            let amount = u128at(&b, 73);
            if amount == 0 || b[41..73] == [0; 32] {
                fail(5)
            };
            if amount > u128at(&c, 112) {
                fail(18)
            }
            let r = reserved();
            if add(add(r, amount), u128at(&c, 152)) > balance() {
                fail(8)
            }
            let mut m = [0; 65];
            m[1..33].copy_from_slice(&b[41..73]);
            m[33..49].copy_from_slice(&amount.to_le_bytes());
            m[57..65].copy_from_slice(&t.to_le_bytes());
            let spent = window(&c, t).1;
            if amount <= u128at(&c, 96) && add(spent, amount) <= u128at(&c, 112) {
                m[0] = 2;
                save(&k, &m);
                spend(&c, t, amount);
                transfer(&m[1..33], amount);
                emit(2, &k, amount);
            } else {
                let next = add(r, amount);
                if next > u128at(&c, 168) {
                    fail(13)
                };
                m[0] = 1;
                m[49..57].copy_from_slice(&due(t, u64at(&c, 128)).to_le_bytes());
                save(&k, &m);
                save(&RESERVED, &next.to_le_bytes());
                emit(1, &k, amount);
            };
            ret(&k)
        }
        // Execute: anyone may release a mature queued message. Window cap still applies.
        2 => {
            if len != 33 {
                fail(1)
            };
            if paused() {
                fail(10)
            };
            let mut k = [0; 32];
            k.copy_from_slice(&b[1..33]);
            let mut m = read::<65>(&k).unwrap_or_else(|| fail(14));
            if m[0] != 1 {
                fail(15)
            };
            if t < u64at(&m, 49) {
                fail(16)
            };
            let amount = u128at(&m, 33);
            let r = reserved();
            if r < amount {
                fail(4)
            };
            if add(r, u128at(&c, 152)) > balance() {
                fail(8)
            };
            spend(&c, t, amount);
            m[0] = 2;
            save(&k, &m);
            save(&RESERVED, &(r - amount).to_le_bytes());
            transfer(&m[1..33], amount);
            emit(2, &k, amount);
            ret(&[0])
        }
        // Cancel: queued funds become available; id remains consumed forever.
        3 => {
            if len != 33 {
                fail(1)
            };
            guardian(&c);
            let mut k = [0; 32];
            k.copy_from_slice(&b[1..33]);
            let mut m = read::<65>(&k).unwrap_or_else(|| fail(14));
            if m[0] != 1 {
                fail(15)
            };
            let amount = u128at(&m, 33);
            let r = reserved();
            if r < amount {
                fail(4)
            };
            m[0] = 3;
            save(&k, &m);
            save(&RESERVED, &(r - amount).to_le_bytes());
            emit(3, &k, amount);
            ret(&[0])
        }
        4 => {
            if len != 1 {
                fail(1)
            };
            guardian(&c);
            save(&PAUSE, &[1]);
            emit(4, &[0; 32], 0);
            ret(&[0])
        }
        // Schedule policy: instant16 cap16 delay8 maxPending16 resume1. Activation delay is immutable.
        5 => {
            if len != 58 || b[57] > 1 {
                fail(1)
            };
            guardian(&c);
            let mut next = c;
            next[96..128].copy_from_slice(&b[1..33]);
            next[128..136].copy_from_slice(&b[33..41]);
            next[168..184].copy_from_slice(&b[41..57]);
            valid(&next);
            let mut p = [0; 73];
            p[..57].copy_from_slice(&b[1..58]);
            p[57..65].copy_from_slice(&due(t, u64at(&c, 144)).to_le_bytes());
            p[72] = 1;
            save(&PLAN, &p);
            emit(5, &[0; 32], 0);
            ret(&[0])
        }
        6 => {
            if len != 1 {
                fail(1)
            };
            let mut p = read::<73>(&PLAN).unwrap_or_else(|| fail(17));
            if p[72] != 1 {
                fail(17)
            };
            if t < u64at(&p, 57) {
                fail(16)
            };
            let mut next = c;
            next[96..128].copy_from_slice(&p[..32]);
            next[128..136].copy_from_slice(&p[32..40]);
            next[168..184].copy_from_slice(&p[40..56]);
            valid(&next);
            save(&CFG, &next);
            if p[56] == 1 {
                save(&PAUSE, &[0])
            };
            p[72] = 0;
            save(&PLAN, &p);
            emit(6, &[0; 32], 0);
            ret(&[0])
        }
        7 => {
            if len != 33 {
                fail(1)
            };
            let mut k = [0; 32];
            k.copy_from_slice(&b[1..33]);
            ret(&read::<65>(&k).unwrap_or_else(|| fail(14)))
        }
        8 => {
            if len != 1 {
                fail(1)
            };
            guardian(&c);
            save(&PLAN, &[0; 73]);
            emit(8, &[0; 32], 0);
            ret(&[0])
        }
        _ => fail(1),
    }
}
