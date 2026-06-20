SYSTEM = "You are a helpful assistant that answers questions about Python."


def build_agent(client):
    return client.create(system_prompt=SYSTEM, tools=[])
