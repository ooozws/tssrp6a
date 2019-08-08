/* eslint-disable no-fallthrough */
// tslint:disable: max-line-length
import { BigInteger } from "jsbn";
import { SRPConfig } from "../src/config";
import { SRPParameters } from "../src/parameters";
import { SRPRoutines } from "../src/routines";
import { SRPClientSession } from "../src/session-client";
import { SRPServerSession } from "../src/session-server";
import { createVerifier } from "../src/utils";
import { test } from "./tests";

test("#SRPSession compatible with nimbusds java implementation, no U padding", (t) => {
  t.plan(3);

  class TestRoutines extends SRPRoutines {
    public generatePrivateValue(): BigInteger {
      return new BigInteger(
        "496993557421161204163243009437446396931089621987166228867825381430598310478552724232175338893085943309322844458622037977610450736647303669282401420783518387091593654245305591568630492124408336898055480790220185594414336311305186561504622750303362867675227156509593310924837768420470062416109994603982012849241281559241343212928642441931019907648691672976952280785510275422238003732540719940795979897949667308357456420122443019724695903918518199221894619196205878219563639903280587615919371037707517469737463169252698161246382118698239117850296427010987117809205722959373004300581599055823946915702512166260047615",
      ).mod(this.parameters.N);
    }
  }

  const config = new SRPConfig(new SRPParameters(), (p) => new TestRoutines(p));

  const testUsername = "peppapig";
  const testPassword = "edge00044bc49a26"; // problematic as reported by https://midobugs.atlassian.net/browse/ISS-325

  const salt = new BigInteger("99830900279124036031422484022515311814");
  const verifier = createVerifier(config, testUsername, salt, testPassword);

  const verifierExpected = new BigInteger(
    "178562055003946915616288416183950560880175291647374906172196005828739793423130057138448557472796429057819212014" +
      "4114935584475633589713081017567690708669637848379136792476825170841578549100791737447582125876753901554573933" +
      "8667640603805500045440488046479293037121037880926546495644470644370531564026094560765922188514892916676817675" +
      "1700937138435898497110083289317944474559572995934674830428142920649062311891412787734495424754159472009938334" +
      "3222059032274510862728323448600730355383444838443223455907492540308650768601338619602737301031438936911752125" +
      "3184029489262122079238259800200292396832028759867302637151706175160538",
  );
  t.true(verifier.equals(verifierExpected), "Verifier is correct");

  const server = new SRPServerSession(config);
  const B = server.step1(testUsername, salt, verifier);

  const client = new SRPClientSession(config);
  client.step1(testUsername, testPassword);
  const { A, M1 } = client.step2(salt, B);
  const expectedM1 =
    "1065592601292658505437124973230696132224053916269139221074815217157714371589931041709024714121209539819670742161" +
    "3994973526242913119722902651388367081536560";
  t.equals(expectedM1, M1.toString(), "Client proof is correct");

  const M2 = server.step2(A, M1);
  const expectedSessionKey: string =
    "1519852899535155115038269998958064151313490935320788775157193642465541136232156324666480443981707748076261268681" +
    "0190374724166732275198953189855701003110539143861878201760992515807094069590801717123003996597081969107624362384" +
    "1339607160070209876244999740795618298206689398689795098465190507762889061970274515460075092634969495292238259548" +
    "8107494794772683954466730599850612152761206380667455047651776927170374696827188176449536079109880457533611677725" +
    "1201000831208457052092898507480366360561541055823459855779537555693683604785680363035153585367738551563087476652" +
    "245431553181367276381496187072794127822495103880767929264";
  client.step3(M2);
  t.equals(
    expectedSessionKey,
    client.sharedKey.toString(),
    "Session key is correct",
  );
});

test("#SRPSession compatible with java nimbus JS, U padding", (t) => {
  t.plan(1);
  class TestClientRoutines extends SRPRoutines {
    public generatePrivateValue(): BigInteger {
      return new BigInteger(
        "9218594351435335554347227626882479378618990417517250846620985446184331504173353991303058629662285691577566168595438313654755240502450060402358784540107021092860845264107404152782891271193878514590953319570683947329473284320097457128605439862781572622464227828872864796144341365162214354887094572282174161962306302099377097317350380019666085856024932929556762485343986530642770951193811252281381371714438112110342953780113973554405163034607901712013426082745251392902574016678749053799742328525051839797771981832061184938166712478933145540909663344235563053474639804669414316792123920275766831187112650798904763761370",
      ).mod(this.parameters.N);
    }
  }

  class TestServerRoutines extends SRPRoutines {
    public generatePrivateValue(): BigInteger {
      return new BigInteger(
        "22711883715196306179388404660664738106531694032622277390041179145498676844677971550875276605663689570917621372457580311533283415945702630671598548790267351980817907550545125038091511705671648303778950699964173027464716249428822915616238217537961763098598557245604064985382226180858718550663921977747884170216045376557895589155531881164520264103735062316858567183780591254403828491463963325331318769059906672050314796226232236102480356154606094584801438223095043435536962190115988287596736257251611449344875432407314943174254386683341332197467614164941524602708763014334738968081979073403475423640309145985693226890164",
      ).mod(this.parameters.N);
    }
  }

  const clientConfig = new SRPConfig(
    new SRPParameters(),
    (p) => new TestClientRoutines(p),
  );

  const serverConfig = new SRPConfig(
    new SRPParameters(),
    (p) => new TestServerRoutines(p),
  );

  const testUsername = "user";
  const testPassword = "&f-/9?7jT3U4D \\";
  const salt = new BigInteger(
    "33081674800485619995650801836188251000879337624391131289848951752125379121888236652092717126360003661818708360248990081822352063268924653696428493658568011717418914956180057471043464751846465778918425243262008467048986429343651595568678881047775976654627197512062204230795243130927191674850747464604824992829",
  );
  const verifier = createVerifier(
    clientConfig,
    testUsername,
    salt,
    testPassword,
  );

  const client = new SRPClientSession(clientConfig);
  client.step1(testUsername, testPassword);

  const server = new SRPServerSession(serverConfig);
  const B = server.step1(testUsername, salt, verifier);

  const credentials = client.step2(salt, B);
  const M2 = server.step2(credentials.A, credentials.M1);

  client.step3(M2);
  t.equals(
    "2759786156664756072640278575111874574304060549707482205494963646655745314302865326281653575240346585867491337174681016141602019474625413612989498308953791169704235345617159889779670194297227661696799560644134207869814438298471533972806431490780438591925780328288881767409814368862177110254785293445114457543719806122296442038029148051000788112414952275196156708046115841664185732743939170543650504827250376106595648546313183003760163749992435120969971921117445460702560169050231954058404706497051470504548923152728722289432905298749321685931674824875086408493662721387058477360406381670834051583796403729153576148296",
    client.sharedKey.toString(),
    "Session key is correct",
  );
});
