async function* myGen() {
  console.log("myGen started");
  yield* await (async () => {
    console.log("inner started");
    throw new Error("Boom");
  })();
}

async function run() {
  console.log("calling myGen");
  const stream = myGen();
  console.log("called myGen");
  try {
    for await (const x of stream) {
      console.log(x);
    }
  } catch (e) {
    console.log("Caught:", e.message);
  }
}
run();
