/* eslint-disable no-fallthrough */
import { BigInteger } from "jsbn";
import { SRPConfig } from "../src/config";
import { SRPParameters } from "../src/parameters";
import { SRPRoutines } from "../src/routines";
import { SRPSession } from "../src/session";
import { SRPClientSession } from "../src/session-client";
import { SRPServerSession } from "../src/session-server";
import {
  bigIntegerToWordArray,
  createVerifier,
  createVerifierAndSalt,
  generateRandomBigInteger,
  generateRandomString,
  hash,
  wordArrayToBigInteger,
} from "../src/utils";
import { test } from "./tests";

const TestConfig = new SRPConfig(
  new SRPParameters(),
  (p) => new SRPRoutines(p),
);

class TestSRPSession extends SRPSession {
  constructor(timeoutMillis?: number) {
    super(TestConfig, timeoutMillis);
  }
}

/**
 * Preconditions:
 * * Server has 'v' and 's' in storage associated with 'I'
 * Step 1:
 * * User --(I, P)--> Client
 * * Client --(I)--> Server
 * * Server calculates 'B' and retrieves 's'
 * * Client <--(B, s)-- Server
 * Step 2:
 * * Client calculates 'A' and 'M1'
 * * Client --(A, M1)--> Server
 * * Server validates client using 'A' and 'M1' and calculates 'M2'
 * * Client <--(M2)-- Server
 * Step 3:
 * * Client validates server using 'M2'
 */
test("#SRP6a_Nimbusds_Session success", (t) => {
  const TEST_COUNT = 20;
  t.plan(TEST_COUNT);
  Array.from(Array(TEST_COUNT).keys()).forEach((i) => {
    const testUsername = generateRandomString(10);
    const testPassword = generateRandomString(15);

    // salt and verifier are generated by client during signup
    // verifier is read from server storage for server.step1
    const { s: salt, v: verifier } = createVerifierAndSalt(
      TestConfig,
      testUsername,
      testPassword,
    );

    const server = new SRPServerSession(TestConfig);
    // server gets identifier from client, salt+verifier from db (from signup)
    const B = server.step1(testUsername, salt, verifier);

    const srp6aNimbusdsClient = new SRPClientSession(TestConfig);
    srp6aNimbusdsClient.step1(testUsername, testPassword);
    const { A, M1 } = srp6aNimbusdsClient.step2(salt, B);

    const M2 = server.step2(A, M1);
    srp6aNimbusdsClient.step3(M2);
    t.pass(
      `Random test #${i} user:${testUsername}, password:${testPassword}, salt: ${salt}`,
    );
  });
});

test("error - wrong password", (t) => {
  t.plan(1);
  const testUsername = generateRandomString(10);
  const testPassword = generateRandomString(15);
  const diffPassword = `${testPassword}-diff`;

  const routines = TestConfig.routines;

  const salt = routines.generateRandomSalt(16);

  const verifier = createVerifier(TestConfig, testUsername, salt, testPassword);

  const serverSession = new SRPServerSession(TestConfig);
  const B = serverSession.step1(testUsername, salt, verifier);

  const clientSession = new SRPClientSession(TestConfig);
  clientSession.step1(testUsername, diffPassword);
  const { A, M1 } = clientSession.step2(salt, B);

  t.throws(() => {
    serverSession.step2(A, M1);
  }, /bad client credentials/i);
});

test("error - not in step 1", (t) => {
  t.plan(1);

  const serverSession = new SRPServerSession(TestConfig);

  t.throws(() => {
    serverSession.step2(BigInteger.ONE, BigInteger.ONE);
  }, /step2 not from step1/i);
});

test('error - not in step "init"', (t) => {
  t.plan(1);
  const testUsername = generateRandomString(10);
  const testPassword = generateRandomString(15);

  const routines = TestConfig.routines;

  const salt = routines.generateRandomSalt(16);

  const verifier = createVerifier(TestConfig, testUsername, salt, testPassword);

  const serverSession = new SRPServerSession(TestConfig);
  serverSession.step1(testUsername, salt, verifier);

  t.throws(() => {
    serverSession.step1(testUsername, salt, verifier);
  }, /step1 not from init/i);
});

test("error - bad/empty A or M1", (t) => {
  t.plan(5);

  const someBigInteger = generateRandomBigInteger();

  t.throws(() => {
    const serverSession = new SRPServerSession(TestConfig);
    serverSession.step1("pepi", someBigInteger, someBigInteger);
    serverSession.step2(null!, BigInteger.ONE);
  }, /Client public value \(A\) must not be null/i);
  t.throws(() => {
    const serverSession = new SRPServerSession(TestConfig);
    serverSession.step1("pepi", someBigInteger, someBigInteger);
    serverSession.step2(null as any, someBigInteger);
  }, /Client public value \(A\) must not be null/i);
  t.throws(() => {
    const serverSession = new SRPServerSession(TestConfig);
    serverSession.step1("pepi", someBigInteger, someBigInteger);
    serverSession.step2(someBigInteger, null!);
  }, /Client evidence \(M1\) must not be null/i);
  t.throws(() => {
    const serverSession = new SRPServerSession(TestConfig);
    serverSession.step1("pepi", someBigInteger, someBigInteger);
    serverSession.step2(someBigInteger, null as any);
  }, /Client evidence \(M1\) must not be null/i);
  t.throws(() => {
    const serverSession = new SRPServerSession(TestConfig);
    serverSession.step1("pepi", someBigInteger, someBigInteger);
    serverSession.step2(BigInteger.ZERO, someBigInteger);
  }, /Invalid Client public value \(A\): /i);
});

test("#SRPSessionGetters success (set values)", (t) => {
  const session = new TestSRPSession();

  session.S = generateRandomBigInteger();

  t.doesNotThrow(() => session.S);
  t.equals(session.sharedKey, session.S);
  t.true(
    session.hashedSharedKey.equals(
      wordArrayToBigInteger(
        hash(session.config.parameters, bigIntegerToWordArray(session.S)),
      ),
    ),
  );
  t.end();
});

test("#SRPSessionGetters failure (not-set values)", (t) => {
  const session = new TestSRPSession();

  t.throws(() => session.S, /shared key.*not set/i);
  t.end();
});

test("#SRPSessionSetters success (not set yet)", (t) => {
  const session = new TestSRPSession();

  const S = generateRandomBigInteger();

  t.doesNotThrow(() => {
    session.S = S;
  });
  t.end();
});

test("#SRPSessionSetters failure (already set)", (t) => {
  const session = new TestSRPSession();

  const S = generateRandomBigInteger();

  session.S = S;

  t.throws(() => {
    session.S = S;
  }, /shared key.*already set/i);
  t.end();
});
