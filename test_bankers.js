/**
 * Banker's Algorithm - Tidewater Simulator Automated Test Suite
 * Tests all 13 required edge cases and core invariants.
 */

const vec = {
  add: (a, b) => a.map((x, i) => x + (b[i] || 0)),
  sub: (a, b) => a.map((x, i) => x - (b[i] || 0)),
  le: (a, b) => a.every((x, i) => x <= (b[i] || 0)),
  eq: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  zero: n => Array(n).fill(0),
  fmt: v => '(' + v.join(', ') + ')'
};

const Engine = {
  need: p => p.done ? vec.zero(p.m.length) : vec.sub(p.m, p.a),
  alloc: S => S.procs.filter(p => !p.done).reduce((t, p) => vec.add(t, p.a), vec.zero(S.names.length)),
  avail: S => vec.sub(S.total, Engine.alloc(S)),
  
  clone: S => ({
    names: [...S.names],
    total: [...S.total],
    procs: S.procs.map(p => ({
      id: p.id,
      name: p.name || p.id,
      a: [...p.a],
      m: [...p.m],
      done: Boolean(p.done),
      released: p.released ? [...p.released] : null
    }))
  }),

  validateState: S => {
    try {
      if (!S || !Array.isArray(S.names) || !Array.isArray(S.total) || !Array.isArray(S.procs)) {
        return 'Missing required state structure';
      }
      const n = S.names.length;
      if (!n || S.total.length !== n) return 'Resource dimension mismatch';
      const isIntVec = v => Array.isArray(v) && v.length === n && v.every(x => Number.isInteger(x) && x >= 0);
      if (!isIntVec(S.total)) return 'Total capacity must be non-negative integers';
      for (const p of S.procs) {
        if (!p || typeof p !== 'object') return 'Process entry invalid';
        if (!isIntVec(p.a) || !isIntVec(p.m)) return `${p.id || 'Process'}: Vectors must be non-negative integers of dimension ${n}`;
        if (!vec.le(p.a, p.m)) return `${p.id}: Current Allocation ${vec.fmt(p.a)} exceeds declared Maximum ${vec.fmt(p.m)}`;
      }
      const totalAlloc = Engine.alloc(S);
      if (!vec.le(totalAlloc, S.total)) return `Total active allocations ${vec.fmt(totalAlloc)} exceed system total ${vec.fmt(S.total)}`;
      return '';
    } catch (e) {
      return 'Malformed state exception: ' + e.message;
    }
  },

  safety: S => {
    let w = Engine.avail(S);
    const fin = S.procs.map(p => Boolean(p.done));
    const trace = [];
    const seq = [];
    
    for (;;) {
      const i = S.procs.findIndex((p, k) => !fin[k] && vec.le(Engine.need(p), w));
      if (i < 0) break;
      const p = S.procs[i];
      const wb = [...w];
      w = vec.add(w, p.a);
      fin[i] = true;
      seq.push(p.id);
      trace.push({
        pid: p.id,
        need: Engine.need(p),
        workBefore: wb,
        released: [...p.a],
        workAfter: [...w]
      });
    }
    
    const blocked = S.procs.filter((p, k) => !fin[k]).map(p => ({
      id: p.id,
      need: Engine.need(p),
      deficits: Engine.need(p).map((req, j) => Math.max(0, req - w[j]))
    }));

    return {
      safe: fin.every(Boolean),
      seq,
      trace,
      blocked,
      finalWork: w
    };
  },

  findAllSafeSequences: (S, limit = 24) => {
    const results = [];
    const activeIndices = [];
    S.procs.forEach((p, i) => { if (!p.done) activeIndices.push(i); });
    const n = activeIndices.length;
    if (n === 0) return [[]];

    function dfs(currentWork, finishSet, currentSeq) {
      if (results.length >= limit) return;
      if (currentSeq.length === n) {
        results.push([...currentSeq]);
        return;
      }
      for (const idx of activeIndices) {
        if (!finishSet.has(idx)) {
          const p = S.procs[idx];
          if (vec.le(Engine.need(p), currentWork)) {
            finishSet.add(idx);
            currentSeq.push(p.id);
            dfs(vec.add(currentWork, p.a), finishSet, currentSeq);
            currentSeq.pop();
            finishSet.delete(idx);
          }
        }
      }
    }

    dfs(Engine.avail(S), new Set(), []);
    return results;
  },

  request: (S, procIdx, r) => {
    const p = S.procs[procIdx];
    const n = S.names.length;
    const R = (code, reason, state = null, sf = null) => ({ code, reason, state, sf, procId: p ? p.id : null, r });

    if (!p) return R('INVALID_PROCESS', 'Selected process does not exist');
    if (!Array.isArray(r) || r.length !== n || !r.every(x => Number.isInteger(x) && x >= 0)) {
      return R('INVALID_INPUT', 'Request vector must contain non-negative integers matching resource dimensions.');
    }
    if (p.done) return R('PROCESS_COMPLETED', `${p.id} has already executed to completion and released its resources.`);
    
    const pNeed = Engine.need(p);
    if (!vec.le(r, pNeed)) {
      return R('EXCEEDS_NEED', `${p.id} requested ${vec.fmt(r)}, which exceeds its remaining declared Need of ${vec.fmt(pNeed)}.`);
    }

    const av = Engine.avail(S);
    if (!vec.le(r, av)) {
      return R('INSUFFICIENT_AVAILABLE', `Requested ${vec.fmt(r)}, but only ${vec.fmt(av)} is currently free in the Available pool. ${p.id} must wait.`);
    }

    // Tentative allocation
    const T = Engine.clone(S);
    T.procs[procIdx].a = vec.add(T.procs[procIdx].a, r);
    const sf = Engine.safety(T);

    if (!sf.safe) {
      const blockedPids = sf.blocked.map(b => b.id).join(', ');
      return R('REJECTED_UNSAFE', `Granting leaves no valid safe execution order. Blocked processes: ${blockedPids}. Tentative allocation rolled back.`, null, sf);
    }

    return R('GRANTED', `Request granted safely. Valid completion order guaranteed: ${sf.seq.join(' → ')}.`, T, sf);
  },

  completeProcess: (S, procIdx) => {
    const p = S.procs[procIdx];
    if (!p || p.done) return { success: false, reason: 'Process already completed or invalid.' };
    const T = Engine.clone(S);
    const target = T.procs[procIdx];
    target.done = true;
    target.released = [...target.a];
    target.a = vec.zero(T.names.length);
    return { success: true, state: T, released: target.released, pid: p.id };
  }
};

// Test Suite Definition
const testCases = [
  {
    id: 1,
    name: 'Edge Case 1: Valid safe state (Silberschatz canonical)',
    run: () => {
      const state = {
        names: ['A', 'B', 'C'],
        total: [10, 5, 7],
        procs: [
          { id: 'P0', a: [0, 1, 0], m: [7, 5, 3], done: false },
          { id: 'P1', a: [2, 0, 0], m: [3, 2, 2], done: false },
          { id: 'P2', a: [3, 0, 2], m: [9, 0, 2], done: false },
          { id: 'P3', a: [2, 1, 1], m: [2, 2, 2], done: false },
          { id: 'P4', a: [0, 0, 2], m: [4, 3, 3], done: false }
        ]
      };
      const av = Engine.avail(state);
      if (!vec.eq(av, [3, 3, 2])) throw new Error(`Expected Available [3,3,2], got ${vec.fmt(av)}`);
      const sf = Engine.safety(state);
      if (!sf.safe) throw new Error('Expected safe state, got unsafe');
      if (sf.seq.length !== 5) throw new Error(`Expected safe sequence length 5, got ${sf.seq.length}`);
      if (sf.seq[0] !== 'P1') throw new Error(`Expected P1 to execute first, got ${sf.seq[0]}`);
      return 'Safe state confirmed with valid completion sequence: ' + sf.seq.join(' → ');
    }
  },
  {
    id: 2,
    name: 'Edge Case 2: Unsafe state with no complete safe sequence (Deadlock)',
    run: () => {
      const state = {
        names: ['A', 'B'],
        total: [1, 1],
        procs: [
          { id: 'P0', a: [1, 0], m: [1, 1], done: false },
          { id: 'P1', a: [0, 1], m: [1, 1], done: false }
        ]
      };
      const av = Engine.avail(state);
      if (!vec.eq(av, [0, 0])) throw new Error(`Expected Available [0,0], got ${vec.fmt(av)}`);
      const sf = Engine.safety(state);
      if (sf.safe) throw new Error('Expected unsafe state, but engine reported safe');
      if (sf.blocked.length !== 2) throw new Error(`Expected 2 blocked processes, got ${sf.blocked.length}`);
      return 'Correctly identified circular deadlock with 0 runnable processes';
    }
  },
  {
    id: 3,
    name: 'Edge Case 3: Multiple valid safe sequences (Permutation discovery)',
    run: () => {
      const state = {
        names: ['R'],
        total: [10],
        procs: [
          { id: 'P0', a: [2], m: [4], done: false }, // Need 2
          { id: 'P1', a: [2], m: [4], done: false }, // Need 2
          { id: 'P2', a: [2], m: [4], done: false }  // Need 2
        ]
      }; // Available = 10 - 6 = 4. Since Available (4) >= all Needs (2), any process can execute first.
      const seqs = Engine.findAllSafeSequences(state);
      // All 3! = 6 permutations must be valid
      if (seqs.length !== 6) throw new Error(`Expected 6 safe sequences, got ${seqs.length}`);
      return `Successfully enumerated all ${seqs.length} valid safe sequence permutations`;
    }
  },
  {
    id: 4,
    name: 'Edge Case 4: Process that can finish only after another process releases resources',
    run: () => {
      const state = {
        names: ['A'],
        total: [10],
        procs: [
          { id: 'P0', a: [4], m: [8], done: false }, // Need: 4
          { id: 'P1', a: [3], m: [5], done: false }  // Need: 2
        ]
      };
      // Available = 10 - (4+3) = 3
      // P0 cannot run (Need 4 > Available 3). P1 CAN run (Need 2 <= Available 3).
      const sf = Engine.safety(state);
      if (!sf.safe) throw new Error('System should be safe');
      if (sf.seq[0] !== 'P1' || sf.seq[1] !== 'P0') {
        throw new Error(`Expected sequence [P1, P0], got [${sf.seq.join(', ')}]`);
      }
      return 'P0 correctly blocked until P1 completed and returned resources to Work';
    }
  },
  {
    id: 5,
    name: 'Edge Case 5: Request that exceeds the requesting process remaining need',
    run: () => {
      const state = {
        names: ['A', 'B'],
        total: [10, 10],
        procs: [
          { id: 'P0', a: [2, 1], m: [4, 3], done: false } // Need: [2, 2]
        ]
      };
      // Request [3, 0] exceeds Need for A (3 > 2)
      const res = Engine.request(state, 0, [3, 0]);
      if (res.code !== 'EXCEEDS_NEED') throw new Error(`Expected EXCEEDS_NEED, got ${res.code}`);
      if (res.state !== null) throw new Error('State must remain null on rejected request');
      return 'Engine rejected request exceeding declared need ceiling';
    }
  },
  {
    id: 6,
    name: 'Edge Case 6: Request that exceeds currently available resources',
    run: () => {
      const state = {
        names: ['A', 'B'],
        total: [5, 5],
        procs: [
          { id: 'P0', a: [1, 1], m: [5, 5], done: false },
          { id: 'P1', a: [3, 3], m: [4, 4], done: false }
        ]
      };
      // Available = [1, 1]. P0 Need = [4, 4]. P0 requests [2, 1].
      // [2, 1] <= Need [4, 4], BUT [2, 1] > Available [1, 1]
      const res = Engine.request(state, 0, [2, 1]);
      if (res.code !== 'INSUFFICIENT_AVAILABLE') throw new Error(`Expected INSUFFICIENT_AVAILABLE, got ${res.code}`);
      return 'Engine deferred request exceeding currently available free pool';
    }
  },
  {
    id: 7,
    name: 'Edge Case 7: Request that would result in an unsafe state',
    run: () => {
      const state = {
        names: ['A', 'B', 'C'],
        total: [10, 5, 7],
        procs: [
          { id: 'P0', a: [0, 1, 0], m: [7, 5, 3], done: false },
          { id: 'P1', a: [2, 0, 0], m: [3, 2, 2], done: false },
          { id: 'P2', a: [3, 0, 2], m: [9, 0, 2], done: false },
          { id: 'P3', a: [2, 1, 1], m: [2, 2, 2], done: false },
          { id: 'P4', a: [0, 0, 2], m: [4, 3, 3], done: false }
        ]
      };
      // P0 requests [0, 3, 0]. Within Need [7, 4, 3], within Available (3, 3, 2).
      // Granting leaves Available B = 0, where every process needs at least 1 unit of B, so none can finish.
      const res = Engine.request(state, 0, [0, 3, 0]);
      if (res.code !== 'REJECTED_UNSAFE') throw new Error(`Expected REJECTED_UNSAFE, got ${res.code}`);
      if (res.state !== null) throw new Error('Unsafe grant was not rolled back');
      return 'Engine prevented transition to unsafe state; rolled back tentative grant';
    }
  },
  {
    id: 8,
    name: 'Edge Case 8: Zero allocated resources',
    run: () => {
      const state = {
        names: ['A', 'B'],
        total: [6, 6],
        procs: [
          { id: 'P0', a: [0, 0], m: [3, 2], done: false },
          { id: 'P1', a: [0, 0], m: [4, 5], done: false }
        ]
      };
      const av = Engine.avail(state);
      if (!vec.eq(av, [6, 6])) throw new Error(`Expected Available [6, 6], got ${vec.fmt(av)}`);
      const sf = Engine.safety(state);
      if (!sf.safe) throw new Error('Initial system with 0 allocations should be safe');
      return 'System with zero allocations successfully verified as safe';
    }
  },
  {
    id: 9,
    name: 'Edge Case 9: Zero available resources',
    run: () => {
      // 9a: All available is 0, but P0 Need is 0 -> P0 can finish and release!
      const stateWithReleasable = {
        names: ['A'],
        total: [4],
        procs: [
          { id: 'P0', a: [4], m: [4], done: false } // Need = 0, holds all 4
        ]
      };
      if (!vec.eq(Engine.avail(stateWithReleasable), [0])) throw new Error('Available should be 0');
      const sf1 = Engine.safety(stateWithReleasable);
      if (!sf1.safe) throw new Error('Process with Need 0 should finish even with 0 available');

      // 9b: All available is 0, and all processes need > 0 -> Deadlock
      const stateDeadlocked = {
        names: ['A'],
        total: [4],
        procs: [
          { id: 'P0', a: [2], m: [3], done: false }, // Need 1
          { id: 'P1', a: [2], m: [3], done: false }  // Need 1
        ]
      };
      const sf2 = Engine.safety(stateDeadlocked);
      if (sf2.safe) throw new Error('State with 0 available and positive needs should be unsafe');
      return 'Correctly evaluated zero-available boundary (both with and without Need=0 processes)';
    }
  },
  {
    id: 10,
    name: 'Edge Case 10: Single process and single resource type',
    run: () => {
      const state = {
        names: ['CPU'],
        total: [8],
        procs: [
          { id: 'P0', a: [3], m: [7], done: false } // Need = 4, Available = 5
        ]
      };
      const sf = Engine.safety(state);
      if (!sf.safe) throw new Error('Single process with Need <= Available must be safe');
      if (sf.seq.length !== 1 || sf.seq[0] !== 'P0') throw new Error('Expected sequence [P0]');
      return 'Single process, 1-dimensional resource system successfully solved';
    }
  },
  {
    id: 11,
    name: 'Edge Case 11: Multiple processes competing for several resource types (4x4 cluster)',
    run: () => {
      const state = {
        names: ['A', 'B', 'C', 'D'],
        total: [6, 5, 7, 6],
        procs: [
          { id: 'P0', a: [1, 0, 1, 1], m: [3, 2, 1, 4], done: false },
          { id: 'P1', a: [1, 2, 0, 0], m: [2, 2, 1, 1], done: false },
          { id: 'P2', a: [1, 1, 2, 1], m: [4, 3, 2, 2], done: false },
          { id: 'P3', a: [2, 0, 1, 1], m: [2, 1, 1, 2], done: false }
        ]
      };
      const av = Engine.avail(state);
      if (!vec.eq(av, [1, 2, 3, 3])) throw new Error(`Expected Available [1,2,3,3], got ${vec.fmt(av)}`);
      const sf = Engine.safety(state);
      if (!sf.safe) throw new Error('Cluster should be safe');
      return `Multi-resource cluster solved with 4 dimensions; safe order: ${sf.seq.join(' → ')}`;
    }
  },
  {
    id: 12,
    name: 'Edge Case 12: Invalid matrix dimensions and invalid numeric input rejection',
    run: () => {
      const base = {
        names: ['A', 'B'],
        total: [5, 5],
        procs: [{ id: 'P0', a: [1, 1], m: [3, 3], done: false }]
      };
      
      // Negative total
      const bad1 = Engine.clone(base);
      bad1.total = [-5, 5];
      if (!Engine.validateState(bad1)) throw new Error('Failed to reject negative total');

      // Allocation > Max
      const bad2 = Engine.clone(base);
      bad2.procs[0].a = [4, 1]; // Max is 3
      if (!Engine.validateState(bad2)) throw new Error('Failed to reject Allocation > Max');

      // Total Allocation > Total Capacity
      const bad3 = Engine.clone(base);
      bad3.total = [0, 5]; // holds 1
      if (!Engine.validateState(bad3)) throw new Error('Failed to reject Total Allocations > Total Capacity');

      // Non-integer in request
      const res1 = Engine.request(base, 0, [1.5, 0]);
      if (res1.code !== 'INVALID_INPUT') throw new Error('Failed to reject fractional request');

      // Dimension mismatch in request
      const res2 = Engine.request(base, 0, [1]);
      if (res2.code !== 'INVALID_INPUT') throw new Error('Failed to reject vector dimension mismatch');

      return 'All invalid numeric and dimensional anomalies rejected by validation barriers';
    }
  },
  {
    id: 13,
    name: 'Edge Case 13: Resetting and switching scenarios after making several edits',
    run: () => {
      const original = {
        names: ['A', 'B'],
        total: [10, 10],
        procs: [
          { id: 'P0', a: [2, 2], m: [5, 5], done: false },
          { id: 'P1', a: [3, 3], m: [6, 6], done: false }
        ]
      };
      
      let state = Engine.clone(original);
      // Perform mutations
      state.procs[0].a = [4, 4];
      state.total[0] = 15;
      Engine.request(state, 0, [1, 0]);
      Engine.completeProcess(state, 1);

      // Reset to original
      state = Engine.clone(original);
      if (!vec.eq(state.total, [10, 10])) throw new Error('Total corrupted after reset');
      if (!vec.eq(state.procs[0].a, [2, 2])) throw new Error('Allocation corrupted after reset');
      if (state.procs[1].done !== false) throw new Error('Process completion corrupted after reset');
      return 'State isolation preserved; reset returns exactly to initial baseline without memory leaks';
    }
  }
];

// Run tests
console.log('='.repeat(72));
console.log('BANKER’S ALGORITHM VERIFICATION TEST SUITE (13 CRITICAL EDGE CASES)');
console.log('='.repeat(72));

let passed = 0;
const results = [];

for (const tc of testCases) {
  const start = Date.now();
  try {
    const detail = tc.run();
    const duration = Date.now() - start;
    passed++;
    results.push({ id: tc.id, name: tc.name, ok: true, duration, detail });
    console.log(`[PASS] [${tc.id}/13] ${tc.name} (${duration}ms)`);
    console.log(`       ↳ ${detail}`);
  } catch (err) {
    const duration = Date.now() - start;
    results.push({ id: tc.id, name: tc.name, ok: false, duration, detail: err.message });
    console.error(`[FAIL] [${tc.id}/13] ${tc.name} (${duration}ms)`);
    console.error(`       ↳ Error: ${err.message}`);
  }
}

console.log('-'.repeat(72));
console.log(`Summary: ${passed} / ${testCases.length} Passed (${Math.round((passed / testCases.length) * 100)}%)`);
console.log('='.repeat(72));

if (passed === testCases.length) {
  process.exit(0);
} else {
  process.exit(1);
}
